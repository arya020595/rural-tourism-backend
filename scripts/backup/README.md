# Database backup scripts

Nightly MySQL backup on the VPS with an encrypted copy in Cloudflare R2, cleanup of
old local copies, and a backup before every production deploy.

- **Why and how it works, decisions, tests, open items:** [`docs/DATABASE_BACKUP.md`](../../docs/DATABASE_BACKUP.md)
- **Setting it up, step by step (Cloudflare, server, cron, Slack, deploy) and restoring:**
  [`docs/DATABASE_BACKUP_SETUP_STEPS.md`](../../docs/DATABASE_BACKUP_SETUP_STEPS.md)

These scripts run on the **server host** (not in a container), from
`~/st_rural_tourism/rutec-backup/scripts/`. They are copied there by hand.

| Script | Runs | What |
|---|---|---|
| `backup-db.sh` | cron, 19:00 UTC (03:00 MYT) | dump → check → `db/rutec-<time>.sql.gz` → encrypt + upload to R2 → `.uploaded` marker → Slack card |
| `cleanup-old-backups.sh` | cron, 19:30 UTC (03:30 MYT) | delete local backups older than 7 days, never the newest 3 (`--dry-run` to preview) |
| `predeploy-backup.sh` | `cd-deploy.yml`, before migrations | dump into `db/predeploy/` (last 5); a failure **stops the deploy** |
| `restore-from-r2.sh` | by hand | `list`, `get latest`, `get <name>`: download, decrypt, check; never imports |
| `lib.sh` | — | shared code (sourced by the others) |
| `backup.env.example` | — | settings template → `~/.config/rutec-backup/backup.env` (chmod 600) |
| `crontab.example` | — | the two cron lines |

## Settings (`~/.config/rutec-backup/backup.env`)

| Setting | Default | Meaning |
|---|---|---|
| `APP_DIR` | `~/st_rural_tourism` | folder with the server's `docker-compose.yml` |
| `DB_SERVICE` | `db` | compose service name of MySQL |
| `BACKUP_ROOT` | `$APP_DIR/rutec-backup` | backups go in `$BACKUP_ROOT/db` |
| `DAILY_KEEP_DAYS` | `7` | local retention |
| `MIN_KEEP` | `3` | newest backups that are never deleted |
| `UPLOAD_GRACE_DAYS` | `7` | a backup that never reached R2 is deleted after this (with an alert) |
| `R2_BUCKET`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | empty | empty `R2_BUCKET` = local backups only |
| `RCLONE_CRYPT_PASSWORD` | empty | the **obscured** encryption password (setup steps, Part E) |
| `SLACK_WEBHOOK_URL` | empty | same webhook as the deploy messages; empty = no cards |
| `HEARTBEAT_BACKUP_URL`, `HEARTBEAT_CLEANUP_URL` | empty | optional missed-run check (e.g. healthchecks.io); not set up yet |
| `SERVER_LABEL` | hostname | shown on the Slack cards |

## Everyday commands (on the server)

```bash
cd ~/st_rural_tourism/rutec-backup/scripts
tail -5 ../logs/backup.log              # last night's result
ls -l ../db ../db/predeploy             # local backups
./restore-from-r2.sh list               # what is in R2
./cleanup-old-backups.sh --dry-run      # what cleanup would delete
./backup-db.sh                          # extra backup now (also uploads)
```

Restoring is in the setup steps ("Restoring").

## Updating the scripts on the server

After changing anything here, copy the scripts again. From Git Bash on your PC, in
the repo folder:

```bash
scp scripts/backup/*.sh stadmin@<server-ip>:/tmp/
```

On the server (check `ls /tmp/*.sh` lists only these files first):

```bash
mv /tmp/*.sh ~/st_rural_tourism/rutec-backup/scripts/
chmod +x ~/st_rural_tourism/rutec-backup/scripts/*.sh
cd ~/st_rural_tourism/rutec-backup/scripts && ./predeploy-backup.sh manual-test && ./backup-db.sh
```

Do this **before** merging a change to `main`: the deploy calls the server's copy of
`predeploy-backup.sh`. Keep the files on LF line endings (`.gitattributes` does this).
