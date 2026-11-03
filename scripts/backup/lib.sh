#!/usr/bin/env bash
# Shared helpers for the backup scripts. Sourced, not run directly.

# Config lives outside git (it holds the Slack/heartbeat URLs).
BACKUP_ENV="${BACKUP_ENV:-$HOME/.config/rutec-backup/backup.env}"

load_config() {
  if [ -f "$BACKUP_ENV" ]; then
    # shellcheck disable=SC1090
    . "$BACKUP_ENV"
  fi

  APP_DIR="${APP_DIR:-$HOME/st_rural_tourism}"
  DB_SERVICE="${DB_SERVICE:-db}"
  BACKUP_ROOT="${BACKUP_ROOT:-$APP_DIR/rutec-backup}"
  DAILY_KEEP_DAYS="${DAILY_KEEP_DAYS:-7}"
  MIN_KEEP="${MIN_KEEP:-3}"
  # A backup that is in R2 is deleted locally after DAILY_KEEP_DAYS. One that
  # never reached R2 is deleted after this many days anyway (with a Slack alert),
  # so a long R2/network outage can't fill the disk. Same as DAILY_KEEP_DAYS =
  # "any backup older than 7 days is deleted"; raise it to wait for the upload.
  UPLOAD_GRACE_DAYS="${UPLOAD_GRACE_DAYS:-7}"

  # Cloudflare R2 (off-site copy). Leave R2_BUCKET empty to run local-only.
  R2_BUCKET="${R2_BUCKET:-}"
  R2_PREFIX="${R2_PREFIX:-db}"
  R2_ACCOUNT_ID="${R2_ACCOUNT_ID:-}"
  R2_ENDPOINT="${R2_ENDPOINT:-https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com}"
  R2_S3_PROVIDER="${R2_S3_PROVIDER:-Cloudflare}"
  R2_ACCESS_KEY_ID="${R2_ACCESS_KEY_ID:-}"
  R2_SECRET_ACCESS_KEY="${R2_SECRET_ACCESS_KEY:-}"
  # Output of: docker run --rm rclone/rclone obscure '<password>'  (see README)
  RCLONE_CRYPT_PASSWORD="${RCLONE_CRYPT_PASSWORD:-}"
  RCLONE_CRYPT_PASSWORD2="${RCLONE_CRYPT_PASSWORD2:-}"
  RCLONE_IMAGE="${RCLONE_IMAGE:-rclone/rclone:1.68.2}"
  SLACK_WEBHOOK_URL="${SLACK_WEBHOOK_URL:-}"
  HEARTBEAT_BACKUP_URL="${HEARTBEAT_BACKUP_URL:-}"
  HEARTBEAT_CLEANUP_URL="${HEARTBEAT_CLEANUP_URL:-}"
  SERVER_LABEL="${SERVER_LABEL:-$(hostname)}"

  case "$BACKUP_ROOT" in
    ""|"/"|"$HOME") echo "Refusing to use BACKUP_ROOT='$BACKUP_ROOT'" >&2; exit 2 ;;
  esac
}

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

# Minimal JSON string escaping (our values are single-line).
json_escape() { printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g' | tr '\n\r' '  '; }

# notify_card "<title>" "<Label>" "<value>" ["<Label>" "<value>" ...]
# Posts a Slack card like the GitHub deploy messages in #deployments (a header
# plus Label/value fields; Slack allows at most 10 fields). Slack is optional
# and must never fail a backup.
notify_card() {
  [ -n "$SLACK_WEBHOOK_URL" ] || return 0
  local title fields="" sep="" label value payload
  title="$(json_escape "$1")"
  shift
  while [ $# -ge 2 ]; do
    label="$(json_escape "$1")"
    value="$(json_escape "$2")"
    shift 2
    fields="${fields}${sep}{\"type\":\"mrkdwn\",\"text\":\"*${label}:*\\n${value}\"}"
    sep=","
  done
  payload="{\"text\":\"${title}\",\"blocks\":[{\"type\":\"header\",\"text\":{\"type\":\"plain_text\",\"text\":\"${title}\"}},{\"type\":\"section\",\"fields\":[${fields}]}]}"
  curl -fsS -m 10 -X POST -H 'Content-type: application/json' --data "$payload" \
    "$SLACK_WEBHOOK_URL" >/dev/null 2>&1 || log "Warning: Slack notification failed"
}

# ping_heartbeat <url> [/fail] — healthchecks.io style; also optional.
ping_heartbeat() {
  local url="$1" suffix="${2:-}"
  [ -n "$url" ] || return 0
  curl -fsS -m 10 --retry 2 "${url}${suffix}" >/dev/null 2>&1 || log "Warning: heartbeat ping failed"
}

# dump_database <file>: dump the database into <file> (gzip), then prove it is
# whole. Returns 1 and sets DUMP_ERROR on any problem; sets DUMP_SIZE on success.
# Used by the nightly backup and the pre-deploy backup, so both check the same way.
# The root password comes from the db container's own environment, so it never
# appears on the host. --single-transaction = consistent snapshot, no table locks.
dump_database() {
  local part="$1"
  DUMP_ERROR=""
  DUMP_SIZE=0
  (
    cd "$APP_DIR" || exit 1
    docker compose exec -T "$DB_SERVICE" sh -c 'exec mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" \
        --single-transaction --quick --routines --triggers --events --hex-blob \
        --databases "$MYSQL_DATABASE"' | gzip -9 > "$part"
  ) || { DUMP_ERROR="the dump command failed"; return 1; }

  # A dump that stopped halfway is worse than none.
  gzip -t "$part" || { DUMP_ERROR="dump is not a valid gzip file"; return 1; }
  zcat "$part" | tail -n 1 | grep -q -- "-- Dump completed" \
    || { DUMP_ERROR="dump is incomplete (no 'Dump completed' line)"; return 1; }
  DUMP_SIZE="$(wc -c < "$part")"
  [ "$DUMP_SIZE" -ge 1024 ] || { DUMP_ERROR="dump is suspiciously small (${DUMP_SIZE} bytes)"; return 1; }
}

# ---------- Cloudflare R2 via rclone (run from its Docker image, nothing to install) ----------

r2_enabled() { [ -n "$R2_BUCKET" ]; }

# Fails early, with a clear message, if R2 is half configured.
r2_check_config() {
  r2_enabled || return 0
  local missing="" v
  for v in R2_ACCOUNT_ID R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY RCLONE_CRYPT_PASSWORD; do
    [ -n "${!v}" ] || missing="$missing $v"
  done
  [ -z "$missing" ] || { echo "R2_BUCKET is set but missing:$missing" >&2; return 1; }
}

# Builds the rclone remotes from environment variables, so no config file (and
# no secret on a command line) is needed:
#   r2     the S3 connection to the bucket
#   rcrypt encrypts contents on top of it; file names stay readable (a ".bin"
#          suffix is added) so the 30-day lifecycle rule and a person can still
#          see which date a file belongs to
setup_rclone_env() {
  export RCLONE_CONFIG_R2_TYPE=s3
  export RCLONE_CONFIG_R2_PROVIDER="$R2_S3_PROVIDER"
  export RCLONE_CONFIG_R2_ENDPOINT="$R2_ENDPOINT"
  export RCLONE_CONFIG_R2_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID"
  export RCLONE_CONFIG_R2_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY"
  # The API token is limited to one bucket and cannot create buckets.
  export RCLONE_CONFIG_R2_NO_CHECK_BUCKET=true
  export RCLONE_CONFIG_RCRYPT_TYPE=crypt
  export RCLONE_CONFIG_RCRYPT_REMOTE="r2:${R2_BUCKET}/${R2_PREFIX}"
  export RCLONE_CONFIG_RCRYPT_PASSWORD="$RCLONE_CRYPT_PASSWORD"
  [ -z "$RCLONE_CRYPT_PASSWORD2" ] || export RCLONE_CONFIG_RCRYPT_PASSWORD2="$RCLONE_CRYPT_PASSWORD2"
  export RCLONE_CONFIG_RCRYPT_FILENAME_ENCRYPTION=off
  export RCLONE_CONFIG_RCRYPT_DIRECTORY_NAME_ENCRYPTION=false
}

# rc <rclone args...>   extra docker args (mounts) go in the RC_DOCKER array.
# Secrets are passed as "-e NAME" (inherited), never "-e NAME=value", so they do
# not show up in `ps`.
RC_DOCKER=()
rc() {
  local args=() v
  while IFS= read -r v; do args+=(-e "$v"); done < <(compgen -e | grep '^RCLONE_CONFIG_' || true)
  docker run --rm "${args[@]}" "${RC_DOCKER[@]}" "$RCLONE_IMAGE" "$@"
}

# r2_upload <file>: encrypt + upload, then check it is really there.
r2_upload() {
  local f="$1" name
  name="$(basename "$f")"
  RC_DOCKER=(-v "$(dirname "$f"):/data:ro")
  rc copyto "/data/$name" "rcrypt:$name" || return 1
  RC_DOCKER=()
  rc lsf "rcrypt:$name" | grep -qxF -- "$name"
}

# Uploads every local backup that has no ".uploaded" marker yet, newest first.
# This also retries files whose upload failed on an earlier night. Returns 1 if
# any upload failed (the files stay local and are retried next run).
upload_pending() {
  local dir="$1" f failed=0 count=0
  while IFS= read -r f; do
    [ -n "$f" ] || continue
    [ -e "$f.uploaded" ] && continue
    log "Uploading $(basename "$f") to R2 (encrypted)"
    if r2_upload "$f"; then
      date '+%Y-%m-%d %H:%M:%S' > "$f.uploaded"
      count=$((count + 1))
    else
      log "ERROR: upload of $(basename "$f") failed"
      failed=1
    fi
  done < <(ls -1t "$dir"/rutec-*.sql.gz 2>/dev/null || true)
  UPLOADED_COUNT="$count"
  return "$failed"
}

# Only one run of the same script at a time (flock is on every Linux server).
single_instance() {
  command -v flock >/dev/null 2>&1 || return 0
  mkdir -p "$BACKUP_ROOT"
  exec 9>"$BACKUP_ROOT/.$1.lock"
  flock -n 9 || { log "$1 is already running, exiting"; exit 0; }
}
