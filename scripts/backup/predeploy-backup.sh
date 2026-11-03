#!/usr/bin/env bash
# Database backup taken by the CD workflow right before a production deploy
# (before migrations run), so a bad migration can be undone.
#
#   predeploy-backup.sh [git-sha]
#   <app folder>/rutec-backup/db/predeploy/predeploy-YYYYMMDD-HHMMSS-<sha>.sql.gz
#
# Exits non-zero if the backup is missing or not whole. The workflow then stops
# BEFORE anything is changed: no backup, no migration. Keeps the last 5. These
# files stay on the server (the nightly job uploads only db/*.sql.gz).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
. "$SCRIPT_DIR/lib.sh"
load_config
single_instance predeploy

KEEP=5
SHA="${1:-manual}"
SHA="${SHA:0:7}"
DIR="$BACKUP_ROOT/db/predeploy"
umask 077
mkdir -p "$DIR"

OUT="$DIR/predeploy-$(date +%Y%m%d-%H%M%S)-$SHA.sql.gz"
PART="$OUT.part"
START="$(date +%s)"

fail() {
  rm -f "$PART"
  log "ERROR: pre-deploy backup failed: $1"
  notify_card "❌ Pre-deploy Backup Failed (deploy stopped)" "Server" "$SERVER_LABEL" "Commit" "$SHA" "Reason" "$1"
  exit 1
}
trap 'fail "script error (line $LINENO)"' ERR

log "Pre-deploy backup of $DB_SERVICE (commit $SHA)"
dump_database "$PART" || fail "$DUMP_ERROR"
mv "$PART" "$OUT"

# Keep the newest $KEEP pre-deploy backups.
ls -1t "$DIR"/predeploy-*.sql.gz 2>/dev/null | tail -n +"$((KEEP + 1))" | while IFS= read -r old; do
  rm -f -- "$old"
done

log "OK: $OUT ($(du -h "$OUT" | cut -f1), $(( $(date +%s) - START ))s)"
