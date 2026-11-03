# Database Backup

How the RuTEC production database is backed up: why, how it works, what was
decided and tested, and what is not done yet.

- **How to set it up or repeat it, step by step:** [`DATABASE_BACKUP_SETUP_STEPS.md`](DATABASE_BACKUP_SETUP_STEPS.md)
- **The scripts and their settings:** [`../scripts/backup/README.md`](../scripts/backup/README.md)
- **The day it was built:** [`debug/DEBUG_LOG_2026-11-03.md`](debug/DEBUG_LOG_2026-11-03.md)

**Status (2026-11-03):** installed and tested on the production server. The
nightly job runs from cron from 2026-11-04 03:00 (Malaysia). The backup before
each deploy starts working when `feat/database-backup` is merged to `main`.

---

## 1. Summary

```
every night 03:00 MYT  backup-db.sh
                       mysqldump ► gzip ► check it is complete ► save on the VPS
                       ► encrypt ► upload to Cloudflare R2 ► verify ► Slack card
every night 03:30 MYT  cleanup-old-backups.sh
                       delete local backups older than 7 days (never the newest 3)
every production       predeploy-backup.sh (from cd-deploy.yml)
deploy                 dump BEFORE the image pull and migrations; deploy stops if it fails
Cloudflare R2          keeps each copy 30 days (lifecycle rule), locked 30 days (bucket lock)
```

| | |
|---|---|
| Max data lost | 24 h (the last nightly backup); less if a deploy ran since |
| Survives losing the whole VPS | Yes, from the encrypted copy in R2 |
| Survives a bad migration | Yes, from the pre-deploy copy taken minutes before |
| We find out when it breaks | Slack card in `#deployments` on every success and failure |
| Cost | About US$0 (R2 free tier: 10 GB; 30 days × 67 MB ≈ 2 GB) |
| Staging | Not backed up (test server) |

---

## 2. Why

Another of our projects lost its database (missing and corrupted) and had no
backup, so recovering it took a lot of manual work. RuTEC was in the same
position:

- one VPS running Docker Compose; production MySQL in a container whose data is a
  Docker volume on that disk; staging and several other projects on the same
  server;
- every merge to `main` deployed and ran `db:migrate` on production **with no
  backup first**;
- the only backups were one-off `mysqldump`s before risky changes and `bk_*` /
  `*_backup_YYYYMMDD` tables inside the same database (`SQL_OPERATIONS_2026-10-08.md`,
  `DEBUG_LOG_2026-10-28.md`): lost together with the server;
- `DEPLOYMENT_MIGRATION_GUIDE.md` said "always maintain recent backups", but
  nothing made them.

The data (bookings, receipts, quotations, payments, companies, users, tourist
names, phones and emails) is business-critical and personal (PDPA), so the
off-site copy is **encrypted** and access-controlled.

---

## 3. What can go wrong, and what covers it

| Scenario | Likely? | Local copy (7 days) | Pre-deploy copy | R2 copy (30 days) |
|---|---|---|---|---|
| Wrong `UPDATE`/`DELETE` (DBeaver, script, seeder) | High | ✅ | — | ✅ |
| A migration breaks or drops data | Medium | ✅ | ✅ fastest | ✅ |
| `docker compose down -v` / `docker volume prune` / `prune --volumes` deletes the MySQL volume | Medium | ✅ | ✅ | ✅ |
| Disk full or a crash mid-write corrupts InnoDB | Medium | ⚠️ if older than the damage | ⚠️ | ✅ |
| Backup folder deleted by mistake | Low | ❌ | ❌ | ✅ |
| VPS lost, wiped or hacked | Low, but fatal | ❌ | ❌ | ✅ (bucket lock stops deletion) |
| Data needed from more than 7 days ago | Low | ❌ | ❌ | ✅ up to 30 days |
| Backups silently stop or are broken | High without checks | Slack card every night; dump checked complete; restore proven (§8) | | |

Most "we had backups" disasters are the last row, so the alerts and the
completeness checks are part of the design, not extras.

---

## 4. How it works

### On the server

```
~/st_rural_tourism/                     the app folder (docker-compose.yml, .env)
├── uploads-backups/                    existing: uploads copied before each deploy (last 5)
└── rutec-backup/
    ├── scripts/                        the files from scripts/backup/ (copied by hand)
    ├── logs/                           backup.log, cleanup.log (written by cron)
    └── db/
        ├── rutec-YYYYMMDD-HHMMSS.sql.gz            nightly, kept 7 days
        ├── rutec-YYYYMMDD-HHMMSS.sql.gz.uploaded   marker: this file is in R2
        └── predeploy/
            └── predeploy-YYYYMMDD-HHMMSS-<sha7>.sql.gz   before each deploy, last 5
~/.config/rutec-backup/backup.env       settings and secrets (chmod 600, not in git)
```

### In Cloudflare R2

```
rutec-db-backups/                       private bucket, Automatic location (Asia-Pacific), Standard
└── db/rutec-YYYYMMDD-HHMMSS.sql.gz.bin contents encrypted with rclone crypt (.bin added)
rules: delete-after-30-days (lifecycle), keep-30-days (bucket lock)
```

### The details that matter

- **The dump** is `mysqldump --single-transaction` run inside the `db` container
  (no table locks, the app keeps working; the root password stays inside the
  container). A dump is only kept if it is a valid gzip, ends with
  `-- Dump completed`, and is not tiny. A dump less than half the size of the
  previous one gets a warning in the Slack card (possible deleted data).
- **The upload** runs `rclone` from its pinned Docker image
  (`rclone/rclone:1.68.2`), so nothing is installed on the server. Secrets are
  passed to the container by name, never on a command line. After uploading, the
  script checks the file is listed in R2 and only then writes the `.uploaded`
  marker. Any older backup without a marker is uploaded again on the next run.
- **Cleanup** only touches `rutec-*.sql.gz` files directly in `db/` (never
  `predeploy/` or other files), never deletes the newest 3 (so if backups stop
  for a week, the last good copies stay), and refuses bad settings. A backup older
  than 7 days that never reached R2 is still deleted, but a 🚨 card is sent first.
- **The pre-deploy backup** uses the same dump and checks (`dump_database` in
  `lib.sh`). If it fails, or the script is missing on the server, the deploy stops
  before pulling the image or migrating, with a ❌ card on top of the usual
  deploy-failed message. These copies stay on the server.
- **Slack** cards use the same webhook and `#deployments` channel as the GitHub
  deploy messages, in the same header + fields style.
- **Times**: the server clock is UTC, so cron uses 19:00 / 19:30 UTC
  (03:00 / 03:30 Malaysia), and **file names are in UTC too**:
  `rutec-20261103-190000.sql.gz` is the backup taken at 03:00 on 4 November
  Malaysia time. Keep this in mind when picking a backup to restore.
- **Who runs it**: the cron jobs run as the user who installed them (`stadmin`); the
  pre-deploy step runs as the deploy user (GitHub secret `SERVER_USER`). Both must be
  the same user, because the scripts and `backup.env` are in that user's home.
- **Silence is not success**: Slack only reports runs that happen. If cron itself
  stops, no card arrives and nothing warns you until the heartbeat check (§9) is set
  up, so glance at `#deployments` for the nightly ✅ card.

---

## 5. Decisions

Decided with the senior dev on 2026-11-03, after his research:

| Topic | Decision | Why |
|---|---|---|
| Frequency | Daily only (no weekly or monthly copies) | Simple; R2 gives 30 days of history |
| Local retention | 7 days; a separate cleanup cron deletes anything older | Backup and cleanup are independent jobs |
| Never-uploaded backups | Also deleted at 7 days, with a 🚨 alert (`UPLOAD_GRACE_DAYS`, default 7, can be raised) | One clear rule; a long R2 outage can't fill the disk; never silent |
| Safety net | The newest 3 backups are never deleted | A stopped backup can't be followed by a cleanup that empties the folder |
| Off-site | Cloudflare R2, daily, 30 days, bucket lock 30 days, token limited to the bucket | Different provider from the VPS; free tier; a hacked server can't delete recent copies |
| Encryption | `rclone crypt`, key on the server | Simple; restores can run unattended. Trade-off: someone with server access could read old backups (they can already read the live DB) |
| Location | `~/st_rural_tourism/rutec-backup/`, files directly in `db/` | Easy to find next to the app |
| Before deploys | Production deploy stops if the backup fails | Never migrate without a backup |
| Staging | Not backed up | Test server with test data |
| Tooling | Host cron + bash, rclone in Docker, nothing installed | Runs even when the backend is down; easy to debug |
| Access | SSH: senior dev, management, Fadzyll. Alerts: `#deployments` | |

### Options considered

| Option | Verdict |
|---|---|
| **Host cron + `mysqldump` + `rclone` (chosen)** | Simple, standard, no new services |
| Backup sidecar container in compose | OK, but another image to trust; compose files aren't in git |
| GitHub Actions job storing dumps as artifacts | No: artifacts expire, anyone with repo access could download personal data |
| Managed MySQL with automatic backups | Best protection, but monthly cost and a migration; revisit if the system grows |
| VPS snapshots only | Same provider, crash-consistent only; a useful extra, not a backup on its own |
| `bk_*` tables only (the old practice) | Still fine before manual SQL, but not a backup |
| `age` instead of `rclone crypt` | Key never on the server, but restores need a person with the key |

---

## 6. Files in the repo

| File | What it does |
|---|---|
| `scripts/backup/backup-db.sh` | Nightly: dump, check, save, upload pending files to R2, Slack card |
| `scripts/backup/cleanup-old-backups.sh` | Nightly: delete local backups older than 7 days (rules in §4); `--dry-run` |
| `scripts/backup/predeploy-backup.sh` | Called by `cd-deploy.yml` before migrations; exit 1 stops the deploy |
| `scripts/backup/restore-from-r2.sh` | `list`, or `get latest` / `get <name>`: download, decrypt, check; prints the import command, never imports |
| `scripts/backup/lib.sh` | Shared: settings, `dump_database`, Slack cards, R2 upload |
| `scripts/backup/backup.env.example` | Settings template (no secrets) |
| `scripts/backup/crontab.example` | The two cron lines (UTC) |
| `.github/workflows/cd-deploy.yml` | Runs `predeploy-backup.sh "$DEPLOY_SHA"` after the uploads copy, before pull and migrations |
| `.gitattributes` | Keeps `*.sh` on LF line endings (CRLF breaks them on Linux) |

---

## 7. Server facts (checked 2026-11-03)

| | |
|---|---|
| Login user | `stadmin` (groups docker, sudo) |
| App folder | `~/st_rural_tourism`: `docker-compose.yml` (services `db`, `backend`, `frontend`), `.env`, `uploads-backups/` |
| MySQL | 8.0.45, binary logging (`log_bin`) ON |
| Database | `rural_tourism`, 102.6 MB; the compressed dump is about 67 MB |
| Disk | 97 GB, 65 GB free |
| Clock | UTC |
| Tools | `docker`, `curl`, `flock`, `gzip` present |
| Crontab | Already had two jobs (another project's Postgres backup at 02:00 UTC, `~/docker-prune.sh` Sundays 02:00 UTC). The prune runs `docker system prune -af` **without** `--volumes`, so it can't delete the database volume. It does remove the rclone image, which the next backup downloads again |
| Volumes | `rt_mysql_data` (production) and `rt_mysql_data_staging` on the same disk, with other projects' volumes |

---

## 8. Tests

| Test | Result |
|---|---|
| All scripts against a fake `docker` standing in for MySQL, R2 and Slack (45 checks: upload and marker, R2 down then retry, cleanup rules, grace period, newest-3 rule, bad settings, Slack JSON, restore, pre-deploy, cleanup ignores `predeploy/`) | ✅ 2026-11-03 |
| Workflow file: YAML parsed, embedded bash checked with `bash -n` | ✅ |
| Real server: first nightly backup by hand | ✅ 67 MB dump, uploaded to R2 in 21 s, `.uploaded` marker written |
| Real server: file visible in the R2 dashboard as `.sql.gz.bin` (69.38 MB) | ✅ |
| Real server: `restore-from-r2.sh get latest` | ✅ downloaded, decrypted, checked complete in 5 s |
| Real server: `cleanup-old-backups.sh --dry-run` | ✅ would delete 0 |
| Real server: `predeploy-backup.sh manual-test` | ✅ 67 MB in 7 s |
| Real server: Slack test card in `#deployments` | ✅ |
| First automatic cron run (2026-11-04 03:00 MYT) | ⏳ check the next morning |
| First production deploy with the pre-deploy step | ⏳ after the merge to `main` |
| **Full import of a backup into a throwaway MySQL** | ❌ not rehearsed yet (do it once, with the senior dev) |
| The "less than half the size" warning; `shellcheck` | Not tested / not run |

---

## 9. Not done yet

Open decisions:

1. **Secrets:** move the R2 keys and the encryption password into the team password
   manager (at least two people + an offline copy) and delete any copies in chat
   apps. Without the encryption password the R2 backups are unreadable.
2. **Emergency deploy without a backup** (e.g. a `skip_backup` input on a manual
   run)? Not decided; today a failed backup always stops the deploy.
3. **VPS provider snapshots** on or off (cost)?
4. **Cloudflare account:** it is a personal account; move to a company account or at
   least add a second admin.
5. Make `scripts/backup/` reusable for the project that lost its database?

Checked before the first merge (2026-11-03): the deploy user is `stadmin`, the user
the scripts are installed under. `/home/stadmin/st_rural_tourism` is the only app
folder, and every deploy starts with `cd ~/st_rural_tourism`. (`README.md` still
mentions an older login, `vmadm001`.)

Later, in rough order of value:

- Heartbeat check, so a cron that stops running is noticed (today only runs that happen
  send a card).
- Restore rehearsal into a throwaway MySQL, then a monthly automatic restore test.
- Protect the MySQL volume: declare it `external: true` in the server compose file so
  `docker compose down -v` can't remove it (after a verified backup, in a quiet hour).
- Disk-space alert at 80% (a full disk is a common cause of MySQL corruption).
- Copy `.env`, the compose files and the nginx config (not in git) off-site, encrypted.
- Uploaded files (logos, licence PDFs) to R2; today they are only copied on the same
  server before each deploy.
- Heartbeat set-up details: healthchecks.io (free), one check each for backup and
  cleanup; the scripts already support `HEARTBEAT_BACKUP_URL` / `HEARTBEAT_CLEANUP_URL`.
- Point-in-time restore: `log_bin` is already ON, so shipping binary logs to R2 every
  15 minutes would cut the worst case from 24 h to about 15 minutes.
- Longer history (weekly or monthly copies) if finance or audit needs it.
- Copy `scripts/backup/` to the server from the deploy workflow instead of by hand.
- Drop old `bk_*` tables in production (`DEBUG_LOG_2026-10-30.md`).

---

## 10. History of the design

1. First proposal: daily / weekly / monthly tiers, `age` encryption, R2.
2. Second: VPS only first, R2 later.
3. **Final (senior dev, 2026-11-03):** daily only, 7 days local, R2 daily for 30
   days with `rclone crypt`, folder inside the app folder, staging not backed up.
