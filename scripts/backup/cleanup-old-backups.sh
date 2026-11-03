#!/usr/bin/env bash
# Deletes database backups older than the retention period. Runs from cron
# after the daily backup, as its own job.
#
#   db/   older than DAILY_KEEP_DAYS   (default 7)
#
# Safety rules, because a cleanup job is the easiest way to lose backups:
#   - only files named rutec-*.sql.gz are touched, never anything else;
#   - the newest MIN_KEEP files (default 3) are always kept, even if they are
#     old. If the daily backup silently stops for a week, cleanup must not
#     delete the last good copies;
#   - with R2 on, a backup is deleted only after it was uploaded (it has a
#     ".uploaded" marker). One that never reached R2 is kept until
#     UPLOAD_GRACE_DAYS (default 7 = same as the retention, so "anything older
#     than 7 days is deleted"), then deleted anyway with a Slack alert, so a
#     long outage can't fill the disk;
#   - retention values must be whole numbers >= 1.
#
# Run with --dry-run to list what would be deleted without deleting anything.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
. "$SCRIPT_DIR/lib.sh"
load_config
single_instance cleanup

DRY_RUN=0
[ "${1:-}" = "--dry-run" ] && DRY_RUN=1

fail() {
  log "ERROR: $1"
  notify_card "❌ Backup Cleanup Failed" "Server" "$SERVER_LABEL" "Reason" "$1"
  ping_heartbeat "$HEARTBEAT_CLEANUP_URL" /fail
  exit 1
}
trap 'fail "script error on line $LINENO"' ERR

is_positive_int() { case "$1" in ""|*[!0-9]*) return 1 ;; esac; [ "$1" -ge 1 ]; }
is_positive_int "$DAILY_KEEP_DAYS"  || fail "DAILY_KEEP_DAYS must be a whole number >= 1 (got '$DAILY_KEEP_DAYS')"
is_positive_int "$MIN_KEEP"         || fail "MIN_KEEP must be a whole number >= 1 (got '$MIN_KEEP')"

is_positive_int "$UPLOAD_GRACE_DAYS" || fail "UPLOAD_GRACE_DAYS must be a whole number >= 1 (got '$UPLOAD_GRACE_DAYS')"
[ "$UPLOAD_GRACE_DAYS" -ge "$DAILY_KEEP_DAYS" ] || fail "UPLOAD_GRACE_DAYS ($UPLOAD_GRACE_DAYS) must not be smaller than DAILY_KEEP_DAYS ($DAILY_KEEP_DAYS)"

DELETED=0
FREED=0
NOT_UPLOADED_DELETED=0
NOT_UPLOADED_KEPT=0

# cleanup_dir <folder> <keep_days>
cleanup_dir() {
  local dir="$1" days="$2" f size
  [ -d "$dir" ] || { log "$dir does not exist, skipping"; return 0; }

  # The newest MIN_KEEP backups are protected no matter how old they are.
  local protected
  protected="$(ls -1t "$dir"/rutec-*.sql.gz 2>/dev/null | head -n "$MIN_KEEP" || true)"

  while IFS= read -r -d '' f; do
    if printf '%s\n' "$protected" | grep -qxF -- "$f"; then
      log "Keeping $f (one of the newest $MIN_KEEP)"
      continue
    fi
    # With R2 on, never delete a backup that has not been uploaded yet,
    # unless it has been waiting longer than the grace period.
    if r2_enabled && [ ! -e "$f.uploaded" ]; then
      if [ -n "$(find "$f" -mtime +"$UPLOAD_GRACE_DAYS" -print)" ]; then
        NOT_UPLOADED_DELETED=$((NOT_UPLOADED_DELETED + 1))
        log "WARNING: $f was never uploaded to R2 and is older than ${UPLOAD_GRACE_DAYS} days"
      else
        NOT_UPLOADED_KEPT=$((NOT_UPLOADED_KEPT + 1))
        log "Keeping $f (older than ${days} days but not uploaded to R2 yet)"
        continue
      fi
    fi
    size="$(wc -c < "$f")"
    if [ "$DRY_RUN" = "1" ]; then
      log "[dry-run] would delete $f"
    else
      rm -f -- "$f" "$f.uploaded"
      log "Deleted $f"
    fi
    DELETED=$((DELETED + 1))
    FREED=$((FREED + size))
  done < <(find "$dir" -maxdepth 1 -type f -name 'rutec-*.sql.gz' -mtime +"$days" -print0)

  # Leftovers of a backup that was killed halfway, and markers whose backup is gone.
  if [ "$DRY_RUN" = "0" ]; then
    find "$dir" -maxdepth 1 -type f -name 'rutec-*.sql.gz.part' -mtime +1 -delete
    while IFS= read -r -d '' f; do
      [ -e "${f%.uploaded}" ] || rm -f -- "$f"
    done < <(find "$dir" -maxdepth 1 -type f -name 'rutec-*.sql.gz.uploaded' -print0)
  fi
}

log "Cleanup start: older than ${DAILY_KEEP_DAYS} days, always keep newest ${MIN_KEEP}"
cleanup_dir "$BACKUP_ROOT/db" "$DAILY_KEEP_DAYS"

if [ "$DRY_RUN" = "1" ]; then
  SUMMARY="[dry-run] would delete ${DELETED} old backup(s), freeing $((FREED / 1024)) KB"
else
  REMAINING="$(find "$BACKUP_ROOT/db" -type f -name 'rutec-*.sql.gz' 2>/dev/null | wc -l | tr -d ' ' || true)"
  SUMMARY="deleted ${DELETED} old backup(s), freed $((FREED / 1024)) KB, ${REMAINING:-0} left"
fi
log "Done: $SUMMARY"

# Only speak up when something was deleted; "no change" every day is noise.
if [ "$DELETED" -gt 0 ] && [ "$DRY_RUN" = "0" ]; then
  notify_card "🧹 Backup Cleanup Done" "Server" "$SERVER_LABEL" "Deleted" "${DELETED} backup(s) older than ${DAILY_KEEP_DAYS} days" "Freed" "$((FREED / 1024)) KB" "Backups left" "${REMAINING:-0}"
fi
if [ "$DRY_RUN" = "0" ] && [ "$NOT_UPLOADED_DELETED" -gt 0 ]; then
  notify_card "🚨 Backups Deleted Without Reaching R2" "Server" "$SERVER_LABEL" "Count" "${NOT_UPLOADED_DELETED} backup(s) older than ${UPLOAD_GRACE_DAYS} days" "Action" "Check the R2 uploads in the backup log and the daily Slack messages"
fi
if [ "$NOT_UPLOADED_KEPT" -gt 0 ]; then
  log "Note: ${NOT_UPLOADED_KEPT} old backup(s) kept because they are not in R2 yet"
fi
[ "$DRY_RUN" = "1" ] || ping_heartbeat "$HEARTBEAT_CLEANUP_URL"
