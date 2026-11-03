# Database Backup — Setup Step by Step

What was done on **2026-11-03** to put the database backup in place, in the order
it was done, so it can be repeated on another server or checked later. Why it works
this way, the decisions and what is still open are in
[`DATABASE_BACKUP.md`](DATABASE_BACKUP.md); the script and settings reference is
[`../scripts/backup/README.md`](../scripts/backup/README.md).

Placeholders: `<server-ip>` is the server address, `<account-id>` is the Cloudflare
account ID (the long ID in the dashboard URL). **Never put keys or passwords in git,
chat or screenshots.**

What you end up with:

```
every night 03:00 (Malaysia)  ► dump ► check ► save on the VPS ► encrypt ► upload to R2 ► Slack card
every night 03:30             ► delete local backups older than 7 days
every production deploy       ► dump BEFORE migrations (deploy stops if it fails)
R2 deletes its copies after 30 days
```

Two terminal windows are used. **Window A** is Git Bash on your own PC (not connected
to the server). **Window B** is the SSH session to the server (prompt
`stadmin@<hostname>`).

---

## Part A — Cloudflare R2 (in the browser, once)

Use a company or shared Cloudflare account if possible, and add a second admin.

1. **Subscribe to R2.** Left menu → *Storage & databases* → *R2 Object Storage* →
   *Add R2 subscription*. A card is needed. The free tier (10 GB, 1M writes/month)
   is enough: a backup is about 67 MB, so 30 days is about 2 GB.
2. **Create the bucket.** *Create bucket*:
   - name `rutec-db-backups` (cannot be changed later);
   - location **Automatic** (it picks Asia-Pacific); do not use "Specify jurisdiction";
   - default storage class **Standard** (not Infrequent Access);
   - public access stays off.
3. **Add the two rules.** Open the bucket → *Settings*:
   - *Object Lifecycle Rules* → *Add*: name `delete-after-30-days`, no prefix,
     tick **Delete uploaded objects after** and enter **30 Days**. Leave the other
     two options unticked.
   - *Bucket Lock Rules* → *Add*: name `keep-30-days`, no prefix, retention period
     **a number of days = 30**. **Do not leave it on "Indefinite"**: nothing could ever
     be deleted and the bucket would grow forever.
   - Both appear in the Settings list as *Enabled*.
4. **Create the API token.** R2 overview → *API* → *Manage API tokens* → *Create
   Account API token*:
   - name `rutec-backup-server`;
   - permission **Object Read & Write** (Read only cannot upload);
   - *Apply to specific buckets only* → `rutec-db-backups`;
   - TTL *Forever*, no IP filtering.
5. On the next page copy **Access Key ID** and **Secret Access Key** (the secret is
   shown once). Ignore "Token value" and the jurisdiction endpoints. The endpoint
   used is `https://<account-id>.r2.cloudflarestorage.com` (the scripts build it).
   Save both in the team password manager straight away.

## Part B — The encryption password

The backup is encrypted before it leaves the server. In **Window A**:

```bash
openssl rand -base64 36
```

Copy the 48-character result into the password manager, shared with at least one
other person. **If it is lost, every backup in R2 is unreadable.** (If `openssl` is
missing, use PowerShell:
`$b = New-Object byte[] 36; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); [Convert]::ToBase64String($b)`.)

## Part C — Look at the server before installing

In **Window B** (this only reads):

```bash
cd ~/st_rural_tourism
whoami; id
ls -la
docker compose config --services
df -h /
docker compose exec -T db mysql --version
timedatectl | head -4
command -v curl flock gzip
crontab -l | grep -v '^#'
docker compose exec -T db sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -e "SELECT table_schema, ROUND(SUM(data_length+index_length)/1024/1024,1) AS mb FROM information_schema.tables GROUP BY table_schema; SHOW VARIABLES LIKE \"log_bin\";"' 2>&1 | grep -v "Using a password"
```

What was found: user `stadmin` (in the `docker` group); folder `~/st_rural_tourism`
with `docker-compose.yml`; services `db`, `backend`, `frontend`; MySQL 8.0.45;
database `rural_tourism` 102.6 MB; 65 GB free of 97 GB; **clock in UTC**; `curl`,
`flock`, `gzip` present; the crontab already had other projects' jobs (so edit it,
never replace it). Also read any existing cron script that touches Docker: here
`~/docker-prune.sh` runs `docker system prune -af` **without** `--volumes`, which is
safe for the database volume (a version with `--volumes` could delete it).

If the service is not called `db`, set `DB_SERVICE` in the config (Part E).

## Part D — Copy the scripts to the server

The scripts live in this repo in `scripts/backup/`. The server's app folder is not a
git repo, so they are copied by hand.

**Window A** (Git Bash on your PC, in the repo folder). Use the real address; do not
type the `<` `>` characters:

```bash
cd "/c/Users/MSI THIN/Documents/GitHub/rural-tourism-backend"
scp scripts/backup/*.sh scripts/backup/backup.env.example stadmin@<server-ip>:/tmp/
```

It asks for the server password (the first time also "authenticity of host ... can't
be established": type `yes`) and lists the six files copied: `backup-db.sh`,
`cleanup-old-backups.sh`, `lib.sh`, `predeploy-backup.sh`, `restore-from-r2.sh`,
`backup.env.example`. (Port other than 22: `scp -P <port> ...`.)

**Window B** (the server). First check that `/tmp` holds only our five scripts, since
the next command moves every `.sh` file in it:

```bash
ls /tmp/*.sh
```

Then:

```bash
mkdir -p ~/st_rural_tourism/rutec-backup/{scripts,logs,db} ~/.config/rutec-backup
mv /tmp/*.sh /tmp/backup.env.example ~/st_rural_tourism/rutec-backup/scripts/
chmod +x ~/st_rural_tourism/rutec-backup/scripts/*.sh
chmod 700 ~/st_rural_tourism/rutec-backup ~/.config/rutec-backup
cp ~/st_rural_tourism/rutec-backup/scripts/backup.env.example ~/.config/rutec-backup/backup.env
chmod 600 ~/.config/rutec-backup/backup.env
ls -l ~/st_rural_tourism/rutec-backup/scripts
```

The five `.sh` files should show `-rwx`. Result: everything under
`~/st_rural_tourism/rutec-backup/` (scripts, logs, `db/`), and the config outside the
app folder in `~/.config/rutec-backup/`.

## Part E — Fill in the configuration

1. **Make the "obscured" form of the encryption password** (rclone needs it
   scrambled). `read -rs` hides what you paste. Paste the **original** password, press
   Enter **once**:

   ```bash
   read -rs PW; echo; echo "length: ${#PW}"; echo -n "$PW" | docker run --rm -i rclone/rclone:1.68.2 obscure -
   ```

   `length:` must be `48` (0 means the paste failed). The first run downloads the
   rclone image (a few seconds). Copy the long line it prints.
2. **Edit the config** and set these lines (no spaces around `=`, no quotes):

   ```bash
   nano ~/.config/rutec-backup/backup.env
   ```

   ```
   R2_BUCKET=rutec-db-backups
   R2_ACCOUNT_ID=<account-id>
   R2_ACCESS_KEY_ID=<access key id>
   R2_SECRET_ACCESS_KEY=<secret access key>
   RCLONE_CRYPT_PASSWORD=<the obscured line from step 1>
   SERVER_LABEL=rutec-production
   ```

   Save with Ctrl+O, Enter, exit with Ctrl+X. Leave `SLACK_WEBHOOK_URL` empty for now.
   Other settings (retention 7 days, keep newest 3) keep their defaults.

## Part F — First backup, checked by hand (before cron)

```bash
cd ~/st_rural_tourism/rutec-backup/scripts
./backup-db.sh
ls -l ../db
./restore-from-r2.sh list
```

Expected: `Dump OK ... (67M)`, `Uploading ... (encrypted)`, `OK ... 21s`; in `../db` a
`.sql.gz` plus a `.sql.gz.uploaded` marker; the file name in the R2 list. Lines
`mysqldump: [Warning] Using a password...` and `NOTICE: Config file ... not found`
are harmless.

Then check in the Cloudflare dashboard: bucket → *Objects* → `db/` shows
`rutec-<date>.sql.gz.bin` (about the same size, unreadable because it is encrypted).

Prove it can be read back (does **not** touch the live database), and preview cleanup:

```bash
./restore-from-r2.sh get latest /tmp/restore-check
rm -r /tmp/restore-check
./cleanup-old-backups.sh --dry-run
```

Expected: `OK ... checked: valid and complete`, then `would delete 0 old backup(s)`.

## Part G — Run it every night (cron)

The server clock is UTC, so Malaysia 03:00 is **19:00 UTC**. Edit (do not replace) the
crontab, adding at the bottom:

```bash
crontab -e
```

```
PATH=/usr/local/bin:/usr/bin:/bin
0 19 * * *  /home/stadmin/st_rural_tourism/rutec-backup/scripts/backup-db.sh >> /home/stadmin/st_rural_tourism/rutec-backup/logs/backup.log 2>&1
30 19 * * * /home/stadmin/st_rural_tourism/rutec-backup/scripts/cleanup-old-backups.sh >> /home/stadmin/st_rural_tourism/rutec-backup/logs/cleanup.log 2>&1
```

Check with `crontab -l | grep -v '^#'`: the other jobs are still there and both of
ours end in `2>&1`. (`crontab.example` in the repo has the same lines.)

## Part H — Slack alerts

Use the same Slack webhook as the GitHub deploy messages, so the cards appear in
`#deployments`. A GitHub secret cannot be read back, so get the URL from Slack (the
Slack app's incoming-webhook settings) or from whoever created it.

```bash
nano ~/.config/rutec-backup/backup.env       # SLACK_WEBHOOK_URL=<the url>
cd ~/st_rural_tourism/rutec-backup/scripts
bash -c '. ./lib.sh; load_config; notify_card "✅ Backup Slack Test" "Server" "$SERVER_LABEL" "Note" "Test message, ignore"'
```

A "Backup Slack Test" card should appear in `#deployments`. The sender is the Slack app
the webhook belongs to (here it shows "ST Intent Harvest", another project's app); the
**Server** field says `rutec-production`. A RuTEC-named webhook can replace it later by
changing only the URL. If the command prints `Slack notification failed`, the URL has
a typo or an extra space.

Optional, not set up yet: a missed-run check. Create two checks at healthchecks.io
(period 1 day, grace 2 hours) and put their ping URLs in `HEARTBEAT_BACKUP_URL` and
`HEARTBEAT_CLEANUP_URL`; it then warns you if cron stops running altogether.

## Part I — The backup before every deploy

`predeploy-backup.sh` is run by `.github/workflows/cd-deploy.yml` before the image pull
and `db:migrate`. If it fails, or is missing on the server, **the deploy stops**
before anything is changed. So the script must be on the server before the first
deploy that contains this workflow.

**Install as the same user the deploy logs in as.** The workflow connects as the GitHub
secret `SERVER_USER` and looks for `~/st_rural_tourism/rutec-backup/scripts/predeploy-backup.sh`
in *that* user's home. Secrets can't be read back, so check on the server that the
scripts sit where the deploy works:

```bash
ls -d /home/*/st_rural_tourism        # only one, under the user you installed as
ls -lt ~/st_rural_tourism/uploads-backups | head -3   # newest = last production deploy
```

`uploads-backups/` is created by every production deploy, so if its newest entry
matches the last deploy date, the deploy runs as this user. (The repo `README.md`
mentions an older login, `vmadm001`; the deploy folder is under `stadmin`.)

It was copied in Part D; try it by hand:

```bash
cd ~/st_rural_tourism/rutec-backup/scripts
./predeploy-backup.sh manual-test
ls -l ../db/predeploy
```

Expected: `OK ... (67M, 7s)` and a file `predeploy-<date>-manual-.sql.gz` (only the first
7 characters of the commit id are kept; a real deploy passes the commit id). After
updating scripts later, also run `./backup-db.sh` once to check the nightly job.

Staging is not backed up (test server).

## Part J — Put it in git without touching the other module

`main` and the work-in-progress feature branch had diverged, and the feature branch
had unrelated uncommitted changes. So the backup got its own branch from `main`:

```bash
# park unrelated changes (reversible). Staged deletions must be unstaged first,
# otherwise stash says "pathspec did not match any file(s) known to git".
git reset -q -- <deleted paths>
git stash push -m "parked for backup branch" -- <paths of the unrelated changes>
git stash list                      # check it is there
git switch -c feat/database-backup main

# commit (scripts must be executable inside git; Windows does not track that)
git add --chmod=+x scripts/backup/*.sh
git add scripts/backup .gitattributes .github/workflows/cd-deploy.yml docs
git commit
git push -u origin feat/database-backup

# later, back on the other branch:
git switch <other-branch> && git stash pop
```

`.gitattributes` keeps `*.sh` on LF line endings; scripts with Windows (CRLF) endings
fail on Linux. Open a pull request into `main`.

## Part K — Merge and verify the first deploy

Merging to `main` deploys production. Do it when you can watch `#deployments`:

1. The usual deploy messages appear. In the workflow run log look for
   `Pre-deploy backup of db (commit ...)` and `OK: ... predeploy-...sql.gz`.
2. On the server: `ls -l ~/st_rural_tourism/rutec-backup/db/predeploy` shows the new file.
3. If the backup fails you also get a ❌ *Pre-deploy Backup Failed* card and the deploy
   stops with nothing changed; fix the cause and re-run the deploy.

## Part L — The morning after

```bash
tail -5 ~/st_rural_tourism/rutec-backup/logs/backup.log
ls -l ~/st_rural_tourism/rutec-backup/db
```

Expect a new `rutec-<date>.sql.gz` with its `.uploaded` marker, a ✅ card in Slack, and
a new file in R2. After a week, older local files disappear (7 days) while R2 keeps
30 days.

## Part M — Finish: secrets and what is still open

1. The R2 Access Key ID, Secret Access Key and the **original** encryption password
   are in the team password manager, readable by at least two people. Delete any
   copies kept in chat apps (Telegram, Slack, WhatsApp).
2. `~/.config/rutec-backup/backup.env` is `chmod 600` and is never committed or pasted.
3. What is not done yet (restore rehearsal, heartbeat, volume protection, uploads to
   R2, and others) is listed in [`DATABASE_BACKUP.md` §9](DATABASE_BACKUP.md#9-not-done-yet).

Changing a script later: copy it to the server again **before** merging to `main`
(commands in [`../scripts/backup/README.md`](../scripts/backup/README.md), "Updating the
scripts on the server").

---

## Restoring

`restore-from-r2.sh` only downloads and checks; it never imports. A full import into a
throwaway MySQL (not production) has **not been rehearsed yet**; do it once before you
need it.

1. **Stop writes and tell the team:** `cd ~/st_rural_tourism && docker compose stop backend`.
2. **If the data itself is damaged** (corruption, volume problems; not needed after a
   plain bad migration), keep the evidence before changing anything: stop MySQL and
   copy its volume aside:
   `docker compose stop db`, then
   `docker run --rm -v rt_mysql_data:/from -v ~/broken-mysql:/to alpine cp -a /from/. /to/`
3. **Pick the backup:**
   - after a bad migration: the newest file in `rutec-backup/db/predeploy/`;
   - otherwise: the newest good one in `rutec-backup/db/`;
   - on a new server, or if the local files are gone: install the scripts and
     `backup.env` (Parts D–E: the R2 settings and the encryption password are all that
     is needed), then `./restore-from-r2.sh get latest` (or `get <name>`; `list` shows
     the names). It downloads, decrypts, checks and prints the import command.
4. **Make sure MySQL is running and healthy.** If its data folder is corrupted, point the
   `db` service at a new, empty volume (or move the old one aside) and start it
   (`docker compose up -d db`), so the import goes into a clean server.
   **After a bad migration**, also roll back the code: redeploy the previous commit (or
   revert the merge on `main`). Otherwise the next deploy runs the same migration again.
5. **Import** (this replaces the data in the database named in the dump):
   `gunzip -c <file> | docker compose exec -T db sh -c 'exec mysql -uroot -p"$MYSQL_ROOT_PASSWORD"'`
6. **Check:** `docker compose run --rm backend npx sequelize-cli db:migrate:status` (all
   `up`), then `docker compose up -d backend`; log in as an operator and open the newest
   booking and receipt.
7. Tell operators which time range (since the backup) needs re-entering, and write it up
   in `docs/debug/`.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `bash: server-ip: No such file or directory` | The `<` `>` of the placeholder were typed. Use the real address only |
| SSH session drops | Idle timeout. Reconnect; files in `/tmp` stay. `ssh -o ServerAliveInterval=30 ...` keeps it alive |
| `obscure` prints nothing | The password was not pasted (`length: 0`). Paste first, then press Enter once |
| Upload fails | Wrong key, token not *Read & Write*, token not on the bucket, or wrong `R2_ACCOUNT_ID`. The backup stays local, a ❌ card is sent, and the next run retries |
| No Slack card | Empty or mistyped `SLACK_WEBHOOK_URL` (check for spaces) |
| Cron did not run | Check the log in `rutec-backup/logs/` and `crontab -l`; times are UTC |
| Production deploy stops at the backup step | The script is missing or not executable on the server, or the dump failed. Read the log lines above the error |
| Backups listed in R2 but cannot be decrypted | The wrong crypt password. The original is in the password manager |
| `.sh` files fail with `^M` / "bad interpreter" | CRLF line endings. Convert with `sed -i 's/\r$//' *.sh` and check `.gitattributes` |
