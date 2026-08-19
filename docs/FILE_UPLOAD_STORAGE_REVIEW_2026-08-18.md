# File & Image Upload Review — Findings and Fixes

**Project:** Rural Tourism Platform (backend + frontend)
**Date:** 2026-08-18
**Scope:** Company logo/document upload and display pipeline, upload security, and upload persistence in deployment
**Related commits:** `rural-tourism-backend@ff86a4e`, `rural-tourism-backend@caa8d28`, `rural-tourism-frontend@91f7942`

---

## 1. Summary

This was a full-stack review of how uploaded files (company logo, MOTAC license, trading/operation license, homestay certificate) are stored, secured, displayed, and persisted — triggered by a request to check whether the existing approach was "best practice" and free of issues. Three separate problems were found and fixed, across three different layers:

| # | Layer | Problem | Fix |
|---|-------|---------|-----|
| A | Frontend | 12 files independently reimplemented "how do I display this stored file value," with 3 mutually inconsistent behaviors | One shared `FileUrlService` |
| B | Backend | Upload `Content-Type` was trusted from the client without verifying actual file bytes; `/uploads` served with no anti-sniffing header | Magic-byte verification + `X-Content-Type-Options: nosniff` |
| C | Deployment | Uploaded files can be silently lost on redeploy if the server's Docker volume mount is misconfigured, with no way to detect it | CD pipeline now backs up uploads before every deploy and fails loudly if the volume isn't real |

A fourth question — **"do we need MinIO?"** — was evaluated and explicitly **not** adopted; see [§5](#5-considered-and-not-done-minio--s3-off-site-backups).

---

## 2. Part A — Frontend: duplicated URL-resolution logic

### 2.1 The problem

Stored file/image values can legitimately be in **four different shapes**, because the backend is mid-migration from base64-in-DB storage to real files on disk (see [`scripts/migrate-company-files-to-disk.js`](../scripts/migrate-company-files-to-disk.js)):

1. A full `http(s)://` or `data:` URL/URI
2. A `/uploads/...` or `uploads/...` path (new, post-migration)
3. A legacy base64 blob with no prefix
4. A legacy bare filename (e.g. `photo.jpg`)

Before this fix, **12 frontend files** each independently guessed which shape they were looking at, and disagreed with each other:

- **Group A (guarded, mostly correct)** — `notification-panel.component.ts`, `notifications.page.ts`, `company-profile.page.ts`, `activity-operator-detail.page.ts`, `header-logo.component.ts`. Checked `data:`/`http(s)://`/`/uploads/`/`uploads/`, then used an `isLikelyBase64` heuristic before treating a value as base64. `activity-operator-detail.page.ts` was the outlier even within this group — its fallback unconditionally wrapped unmatched values as `data:image/png;base64,...` instead of returning them as-is.
- **Group B (unguarded)** — `receipt.page.ts`, `receipt-package.page.ts`, `receipt-activity.page.ts`, `my-transaction.page.ts`. Skipped the base64 heuristic entirely — any non-`data:` value with no `/` was blindly wrapped as base64, silently producing garbage for anything that wasn't actually base64.
- **Group C (bare-filename assumption)** — `accomodation-detail.page.ts`, `activity-operator-list.page.ts`, `home.page.ts`. Never checked for `/uploads/` paths at all — any unmatched value was assumed to be a bare filename and prefixed with a hardcoded folder (e.g. `${API}/uploads/accommodations/${value}`). If one of these ever received a `/uploads/...` path, the result would have been a broken double-prefixed URL.

**Net effect:** the exact same stored value could render correctly on one screen and silently break on another, and every new screen that copied an existing pattern inherited whichever bug that pattern had.

### 2.2 The fix

New file: [`rural-tourism-frontend/src/app/services/file-url.service.ts`](../../rural-tourism-frontend/src/app/services/file-url.service.ts)

A single injectable `FileUrlService` with one method:

```ts
resolve(
  value: string | null | undefined,
  options?: { base64MimeType?: 'image/png' | 'image/jpeg' | 'application/pdf'; legacySubdir?: string }
): string
```

Resolution order (same for every caller, no more per-screen guessing):

1. `data:` / `http://` / `https://` / `blob:` / `assets/` → returned as-is
2. `/uploads/...` or `uploads/...` → prefixed with `environment.API`
3. Looks like base64 (`isLikelyBase64` heuristic, ported from the old `company-profile.page.ts` implementation) → wrapped as `data:<mime>;base64,...`
4. Otherwise, if the caller passed `legacySubdir` (Group C's old behavior) → `${API}/uploads/<subdir>/<value>`
5. Otherwise → returned as-is

All 12 duplicate implementations (`resolveLogoUrl`, `resolveSource`, `getLogoSrc`, `resolveImageSource` ×3, `getAccommodationImage`, `getOperatorImage`, `buildImageUrl`, and the inline logic in `header-logo.component.ts`) were replaced with calls into this service. Component-specific logic that isn't pure string resolution — `company-profile.page.ts`'s blob-URL conversion for the in-page document preview modal (`dataUrlToBlobUrl`, `base64ToBlobUrl`, `URL.revokeObjectURL` cleanup on destroy) — was left in place; only the shape-detection moved.

**Files changed** (`rural-tourism-frontend`):

```
src/app/services/file-url.service.ts                              (new)
src/app/_components/header-logo/header-logo.component.ts
src/app/_shared/notification-panel/notification-panel.component.ts
src/app/notifications/notifications.page.ts
src/app/company-profile/company-profile.page.ts
src/app/tourist/activity-operator-detail/activity-operator-detail.page.ts
src/app/receipt/receipt.page.ts
src/app/receipt-package/receipt-package.page.ts
src/app/receipt-activity/receipt-activity.page.ts
src/app/my-transaction/my-transaction.page.ts
src/app/tourist/accomodation-detail/accomodation-detail.page.ts
src/app/tourist/activity-operator-list/activity-operator-list.page.ts
src/app/tourist/home/home.page.ts
```

> **Note on Group C:** no backend upload path was actually found for accommodation/activity images at the time of this review — no `uploads/accommodations` or `uploads/operator-activities` directory on disk, and `accomController.js`/`activityController.js` assign the `image` field straight from the request body as a string rather than via a multer file field. The `legacySubdir` option preserves those 3 screens' pre-existing behavior exactly, so nothing regresses either way — but if that code path turns out to be dead, it's a candidate for cleanup in a future pass.

---

## 3. Part B — Backend: upload security hardening

### 3.1 Baseline (already solid, unchanged)

[`middleware/uploadLogo.js`](../middleware/uploadLogo.js) uses `multer.memoryStorage()` with:
- A per-field mimetype allowlist (`fileFilter`) — logo accepts `image/jpeg`/`image/png` only; the three document fields additionally accept `application/pdf`.
- `limits.fileSize: 5 * 1024 * 1024` (5MB per file), enforced server-side independent of the frontend's own 5MB/20MB checks in `company-profile.page.ts`.
- [`utils/fileStorage.js`](../utils/fileStorage.js)'s `saveBufferToDisk` always generates a `crypto.randomUUID()` filename — no path traversal risk from user-supplied names.

A raw API client could not bypass type/size checks before this review, and still can't.

### 3.2 Gap 1 — Content-Type was trusted, not verified

`fileFilter` only checks `file.mimetype`, which is the client-supplied `Content-Type` header on the multipart part — trivially spoofable. A malicious file renamed with `Content-Type: image/png` would have passed straight through to disk.

**Fix:** [`utils/fileStorage.js`](../utils/fileStorage.js) gained two new exports:

```js
// Sniffs the actual magic bytes via the `file-type` package (v16.5.4 — last
// CommonJS-compatible release; v17+ is ESM-only) and rejects on mismatch.
const verifyFileType = async (buffer, declaredMimetype) => { ... }

// Verifies then writes — this is what upload call sites should use instead
// of saveBufferToDisk directly.
const saveUploadedFile = async (buffer, mimetype, subdir = "companies") => {
  await verifyFileType(buffer, mimetype);
  return saveBufferToDisk(buffer, mimetype, subdir);
};
```

Wired into the two live upload call sites:
- [`parsers/companyParser.js`](../parsers/companyParser.js) — `extractCompanyUpdateFields` (company profile update) is now `async` and awaits `saveUploadedFile`; [`controllers/companyController.js`](../controllers/companyController.js)'s `updateCompany` was updated to `await` it.
- [`services/authService.js`](../services/authService.js) — `registerOperator` now verifies all 4 possible files in parallel (`Promise.all`) before opening the DB transaction, then passes the already-saved paths into `Company.create`.

`saveBufferToDisk` itself was **not** changed — [`scripts/migrate-company-files-to-disk.js`](../scripts/migrate-company-files-to-disk.js) still calls it directly, since that script re-encodes already-trusted data already sitting in the database, not fresh untrusted uploads.

A mismatch throws a `statusCode: 400` error, which `errorResponse()` (see [`utils/helpers.js`](../utils/helpers.js)) already surfaces correctly since it reads `err.statusCode`.

**Verified with a manual smoke test:** a real 1×1 PNG (correct magic bytes) was accepted; a plain-text buffer declared as `image/png` was rejected with `"Uploaded file content does not match its declared type (image/png)."` / HTTP 400.

### 3.3 Gap 2 — no anti-sniffing header on `/uploads`

[`server.js`](../server.js) served `/uploads` via plain `express.static` with no headers at all. Combined with Gap 1, a spoofed file that slipped through would have been served back with whatever `Content-Type` the browser inferred, rather than being forced to download or treated strictly as its extension implies.

**Fix** (`server.js`, uploads mount):

```js
app.use(
  "/uploads",
  express.static(path.join(__dirname, "uploads"), {
    setHeaders: (res) => {
      res.setHeader("X-Content-Type-Options", "nosniff");
    },
  }),
);
```

**Verified** by serving a real file locally and confirming the header on a `200` response (`X-Content-Type-Options: nosniff` present).

### 3.4 New dependency

`file-type@16.5.4` was added to `package.json`/`package-lock.json`. Pinned to v16 specifically because v17+ dropped CommonJS support (ESM-only), and this backend is CommonJS (no `"type": "module"` in `package.json`).

**Files changed** (`rural-tourism-backend`):

```
utils/fileStorage.js          (+ verifyFileType, + saveUploadedFile)
parsers/companyParser.js      (extractCompanyUpdateFields is now async)
controllers/companyController.js  (await extractCompanyUpdateFields)
services/authService.js       (registerOperator verifies files before the transaction)
server.js                     (nosniff header on /uploads)
package.json / package-lock.json  (+ file-type@16.5.4)
```

---

## 4. Part C — Deployment: upload persistence safety net

### 4.1 The risk

The deployment is a **single VPS running Docker Compose** (not Kubernetes, not multiple replicas) driven by `.github/workflows/cd-deploy.yml` / `cd-deploy-staging.yml`, which SSH into the server and run `docker compose pull && up -d`. The repo's `docker-compose.production.yml` / `docker-compose.staging.yml` (at the parent `rural-tourism-new/` level, **not tracked in either git repo**) declare a named Docker volume for uploads (`backend_uploads:/app/uploads`), which normally survives a container recreate.

Two things made this untrustworthy in practice:

1. The CD workflow only ever runs `docker compose pull && up -d` on the server — it **never syncs the compose file itself**. Whatever `~/st_rural_tourism/docker-compose.yml` contains on the live VPS was placed there manually at some point, and there was no way to confirm from the repo whether it still matches.
2. **25 files were found manually committed into `uploads/` in git** (logos, association images, even receipt PDFs), and `fileStorage.js` references a `scripts/restore-seed-company.js` for restoring legacy company data — both consistent with a **past incident** where uploaded files were lost and manually re-seeded rather than the root cause being fixed.

### 4.2 The fix

Rather than a one-time manual SSH fix (Claude has no access to the production server — see [§4.3](#43-what-was-not-verified)), both `.github/workflows/cd-deploy.yml` and `cd-deploy-staging.yml` were updated to make the deploy pipeline self-defending:

1. **Pre-deploy backup** — before pulling/restarting, `docker cp`'s the running container's `/app/uploads` to a timestamped folder on the host (`~/st_rural_tourism/uploads-backups/uploads-<timestamp>`, keeps the 5 most recent). Skipped gracefully if there's no currently-running container (first-ever deploy).
2. **Post-deploy verification** — after restart, `docker inspect`'s the new container's mounts and checks that `/app/uploads` is mounted with `"Type": "volume"`. If it isn't, the deploy script `exit 1`s with a clear error message, which fails the whole GitHub Actions job and triggers the **existing** Slack failure notification (`if: always()` step, unchanged).

```bash
# excerpt — same shape in both workflows, service name differs (backend / backend_staging)
NEW_ID=$(docker compose ps -q backend)
MOUNT_TYPE=$(docker inspect "$NEW_ID" --format '{{ range .Mounts }}{{ if eq .Destination "/app/uploads" }}{{ .Type }}{{ end }}{{ end }}')
if [ "$MOUNT_TYPE" != "volume" ]; then
  echo "ERROR: /app/uploads is not mounted as a persistent Docker volume ..."
  exit 1
fi
```

This converts "silent data loss on a bad redeploy" into "the deploy fails loudly and nothing gets overwritten" — the failure surfaces before any files are actually at risk, because the *previous* container's uploads were already `docker cp`'d out in step 1 regardless of what happens next.

**Verified locally** (not against the production server — see below) against real Docker containers:
- A container with a real named-volume mount at `/app/uploads` → detected as `Type: volume` ✅
- A container with no such mount → detected as empty string (correctly fails the check) ✅
- `docker cp` backup correctly captured file contents ✅
- Both workflow files pass YAML parsing and the embedded bash scripts pass `bash -n` syntax checks ✅

### 4.3 What was *not* verified

Claude does not have SSH access to the production VPS and cannot obtain it — an outbound SSH connection attempt was categorically blocked by the sandbox's permission classifier, independent of whether credentials were supplied. (Credentials were briefly shared in chat during this review to attempt this; **that password should be rotated on the server**, since it's now sitting in a session transcript.)

As a result, **the actual state of the live server's `docker-compose.yml` was never directly confirmed**. The safety net in [§4.2](#42-the-fix) is designed so this doesn't matter going forward — the very next deploy will either succeed (mount is fine) or fail loudly with a specific, actionable error (mount is missing/wrong) — but if you want to confirm proactively rather than waiting for the next deploy, run on the server directly:

```bash
cd ~/st_rural_tourism   # or ~/st_rural_tourism_staging
docker compose ps
docker inspect <backend_container_id> --format '{{ json .Mounts }}' | jq
# look for an entry with "Destination": "/app/uploads" and "Type": "volume"
```

---

## 5. Considered and *not* done: MinIO / S3, off-site backups

**Question raised:** should uploads move to MinIO (or another S3-compatible object store) instead of local disk?

**Decision: not adopted**, for a confirmed single-VPS, single-replica deployment (no Kubernetes, no load balancer, no `replicas:` config found anywhere). Reasoning:

- MinIO solves problems this deployment doesn't currently have: sharing files across multiple app instances, and surviving a fully ephemeral container filesystem. Neither applies here — Compose already declares a named volume, which is host-local storage that persists across container recreates on the *same* VPS.
- Running MinIO on the *same single disk* as everything else would not add real durability — it would just move the identical single-point-of-failure risk into another service, while adding real operational cost (a service to deploy, secure, patch, and monitor).
- The actual, cheaper problem — silent data loss from a misconfigured/drifted compose file — is what [§4](#4-part-c--deployment-upload-persistence-safety-net) fixes directly, without any of that migration cost.

**Noted as a future option, not implemented:** if real disaster-recovery durability is wanted later (the VPS itself, not just a container, could be lost), the cheapest next step is shipping the `uploads-backups/` folders from §4.2 to an off-site bucket (Backblaze B2, DigitalOcean Spaces, or yes, even a MinIO instance — but used purely as a backup target, not as primary storage) via a periodic `rclone`/`rsync` step. That's a pure infra addition with **zero application code changes**, unlike a full migration to object storage as the primary backend (which would mean rewriting `fileStorage.js`'s `fs` calls to the S3 API and reworking `FileUrlService` for signed/bucket URLs).

Revisit this if the deployment ever moves to multiple replicas/instances, or if off-site durability becomes a hard requirement.

---

## 6. Verification performed

| Check | Result |
|---|---|
| Frontend `tsc -p tsconfig.app.json --noEmit` | Clean (2 pre-existing, unrelated `@capacitor/*` errors only) |
| Backend `npx jest --config jest.unit.config.js` | 165/165 tests passing, 12/12 suites |
| `node -c` syntax check on all 5 touched backend files | All pass |
| Manual: real PNG through `saveUploadedFile` | Accepted, written to disk |
| Manual: text file declared as `image/png` through `saveUploadedFile` | Rejected, HTTP 400 |
| Manual: `curl`/Node request against a file served through the updated `/uploads` static mount | `X-Content-Type-Options: nosniff` present on `200` response |
| Manual: Docker container with/without a real volume mount at `/app/uploads` | Mount-type detection in the CD workflow correctly distinguishes both cases |
| `docker cp` backup step | Confirmed it captures real file contents |
| YAML + `bash -n` on both CD workflow files | Both valid |

Not verified (see [§4.3](#43-what-was-not-verified)): the actual live production/staging server's compose file and running container mount state.

---

## 7. Residual follow-ups

- [ ] Rotate the `stadmin` VPS password (was pasted into a chat session during this review).
- [ ] Confirm on the next production/staging deploy that the new mount-verification step passes (or, if it fails, fix `docker-compose.yml` on the server to match `docker-compose.production.yml` / `docker-compose.staging.yml`).
- [ ] Optional: ship `uploads-backups/` off-site if disaster-recovery durability (surviving loss of the whole VPS, not just a bad redeploy) becomes a requirement — see [§5](#5-considered-and-not-done-minio--s3-off-site-backups).
- [ ] Optional: confirm whether Group C's accommodation/activity image upload path (§2.2 note) is actually reachable in production; remove the `legacySubdir` fallback and dead code if not.
