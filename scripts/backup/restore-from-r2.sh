#!/usr/bin/env bash
# Lists or downloads (and decrypts) database backups from Cloudflare R2.
# Use it to recover onto a new VPS, or to check what is stored off-site.
#
#   restore-from-r2.sh list
#   restore-from-r2.sh get latest            [dest_dir]
#   restore-from-r2.sh get rutec-20261103-030000.sql.gz [dest_dir]
#
# dest_dir defaults to <backup folder>/restore. This script only DOWNLOADS. It
# never touches the live database; it prints the import command for you to run.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
. "$SCRIPT_DIR/lib.sh"
load_config

r2_enabled || { echo "R2_BUCKET is not set in $BACKUP_ENV" >&2; exit 2; }
r2_check_config || exit 2
setup_rclone_env

ACTION="${1:-}"
case "$ACTION" in
  list)
    rc lsf rcrypt: | sort
    ;;
  get)
    NAME="${2:-}"
    [ -n "$NAME" ] || { echo "usage: $0 get <name|latest> [dest_dir]" >&2; exit 2; }
    DEST="${3:-$BACKUP_ROOT/restore}"
    umask 077
    mkdir -p "$DEST"
    DEST="$(cd "$DEST" && pwd)"

    if [ "$NAME" = "latest" ]; then
      NAME="$(rc lsf rcrypt: | grep '^rutec-.*\.sql\.gz$' | sort | tail -n 1)"
      [ -n "$NAME" ] || { echo "No backups found in R2" >&2; exit 1; }
    fi

    log "Downloading and decrypting $NAME to $DEST"
    RC_DOCKER=(--user "$(id -u):$(id -g)" -v "$DEST:/out")
    rc copyto "rcrypt:$NAME" "/out/$NAME"
    gzip -t "$DEST/$NAME" || { echo "Downloaded file is not a valid gzip, wrong crypt password?" >&2; exit 1; }
    zcat "$DEST/$NAME" | tail -n 1 | grep -q -- "-- Dump completed" || { echo "Downloaded dump is incomplete" >&2; exit 1; }

    log "OK: $DEST/$NAME ($(du -h "$DEST/$NAME" | cut -f1)), checked: valid and complete"
    cat <<EOF

To load it into MySQL (this REPLACES the data in the database named in the dump):

  cd $APP_DIR
  gunzip -c "$DEST/$NAME" | docker compose exec -T $DB_SERVICE sh -c 'exec mysql -uroot -p"\$MYSQL_ROOT_PASSWORD"'

Then: docker compose run --rm backend npx sequelize-cli db:migrate:status
EOF
    ;;
  *)
    echo "usage: $0 list | get <name|latest> [dest_dir]" >&2
    exit 2
    ;;
esac
