#!/usr/bin/env bash
# Daily RuTEC database backup. Runs from the VPS host's cron, not inside Docker.
#
#   <app folder>/rutec-backup/db/rutec-YYYYMMDD-HHMMSS.sql.gz    one file per run
#
# Then (when R2_BUCKET is set) every backup that is not in Cloudflare R2 yet is
# encrypted and uploaded, and marked with a ".uploaded" file next to it.
# Old files are removed by cleanup-old-backups.sh, not here.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
. "$SCRIPT_DIR/lib.sh"
load_config
single_instance backup-db

DB_DIR="$BACKUP_ROOT/db"
umask 077
mkdir -p "$DB_DIR"

STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="$DB_DIR/rutec-$STAMP.sql.gz"
PART="$OUT.part"
START="$(date +%s)"

fail() {
  local msg="$1"
  rm -f "$PART"
  log "ERROR: $msg"
  notify_card "❌ Database Backup Failed" "Server" "$SERVER_LABEL" "Reason" "$msg"
  ping_heartbeat "$HEARTBEAT_BACKUP_URL" /fail
  exit 1
}
trap 'fail "dump command failed or script error (line $LINENO)"' ERR

# Newest earlier backup, for the "did it suddenly shrink?" check.
PREVIOUS="$(ls -1t "$DB_DIR"/rutec-*.sql.gz 2>/dev/null | head -n 1 || true)"

log "Dumping database ($DB_SERVICE in $APP_DIR)"
dump_database "$PART" || fail "$DUMP_ERROR"
SIZE="$DUMP_SIZE"

mv "$PART" "$OUT"

WARN=""
if [ -n "$PREVIOUS" ]; then
  PREV_SIZE="$(wc -c < "$PREVIOUS")"
  if [ "$PREV_SIZE" -gt 0 ] && [ $((SIZE * 2)) -lt "$PREV_SIZE" ]; then
    WARN="Less than half the size of the previous backup (${PREV_SIZE} -> ${SIZE} bytes). Check for deleted data."
  fi
fi

log "Dump OK: $OUT ($(du -h "$OUT" | cut -f1))"

# Off-site copy. A failed upload does not undo the local backup, but it is an
# error: Slack + failed heartbeat, non-zero exit. The file is retried next run.
OFFSITE="Local only (R2 not configured)"
if r2_enabled; then
  r2_check_config || fail "R2 settings incomplete"
  setup_rclone_env
  if upload_pending "$DB_DIR"; then
    OFFSITE="Cloudflare R2, encrypted (${UPLOADED_COUNT} file(s) uploaded)"
  else
    fail "backup saved locally, but the upload to R2 FAILED (will retry next run)"
  fi
fi

SECS=$(( $(date +%s) - START ))
log "OK: $OUT ($(du -h "$OUT" | cut -f1), ${SECS}s)"
FIELDS=("Server" "$SERVER_LABEL" "File" "$(basename "$OUT")" "Size" "$(du -h "$OUT" | cut -f1)" "Duration" "${SECS}s" "Off-site copy" "$OFFSITE")
[ -z "$WARN" ] || FIELDS+=("Warning" "$WARN")
notify_card "✅ Database Backup Succeeded" "${FIELDS[@]}"
ping_heartbeat "$HEARTBEAT_BACKUP_URL"
