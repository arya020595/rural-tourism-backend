# Registration Approval & Member Status — Backend

As-built reference for operator registration approval (branch
`features/newfeatures29oct`, 2026-10-30 → 2026-11-02). The frontend side is in
the frontend repo at `docs/REGISTRATION_APPROVAL_FRONTEND.md`; the change log is
`docs/debug/DEBUG_LOG_2026-11-02.md`.

This replaces the original plan in `docs/design/REGISTRATION_APPROVAL_PLAN.md`.
The plan's mockups show Approved / Rejected tabs and a dashboard card. What was
built uses **Pending / Active / Inactive** tabs, has a Deactivate action, and
has no dashboard card.

> Stack and layering follow `CLAUDE.md`: route → `authenticate → authorize →
> asyncHandler(controller)` → controller (per-record policy, serializer) →
> service (all Sequelize, typed `AppError`s).

---

## 1. What it does

A new operator company can't use the system until **its association** (or a
superadmin) approves it. After that, the association can **deactivate** a
member (it can no longer log in) and **activate** it again.

1. The operator registers and must choose an association. The company is
   saved as `pending`.
2. Active users of that association and all superadmins get a bell
   notification.
3. Pending and inactive companies **can't log in**. A user already logged in is
   signed out on their next request.
4. The association approves, rejects, deactivates or activates from the
   approvals page. Each decision emails the operator (best effort, in the
   background).

## 2. Statuses

One column, `companies.registration_status`, has three values. The app shows
them as the association sees them:

| Stored | Shown as | Can log in | Reached by |
|---|---|---|---|
| `pending` | Menunggu/Pending | ❌ | new operator registration |
| `approved` | Aktif/Active | ✅ | Approve (from pending) or Activate (from inactive) |
| `rejected` | Tidak Aktif/Inactive | ❌ | Reject (from pending) or Deactivate (from active), reason required |

- `rejected` covers both a refused registration and a member that was
  deactivated. The login message is neutral ("Akaun syarikat anda tidak
  aktif… / Your company account is inactive…"), so it fits both.
- `approved` is the column default. **Every company that existed before the
  migration stays approved and keeps working.** A company with no status at
  all also counts as approved (`registrationBlock` in
  `utils/registrationHelpers.js`).
- Moving to the status a company already has returns **409**.
- The block applies to the **whole company**: owner and staff accounts alike.
  Bookings, receipts and quotations are untouched and come back on activation.

## 3. Database

### Migrations

| File | What |
|---|---|
| `migrations/20261030130000-add-registration-approval.js` | the five `companies.registration_*` columns, index `idx_companies_registration_status`, backfills `registration_submitted_at = created_at`, creates permission `registration:approve` (section *Association*) and grants it to the `association` role |
| `migrations/20261030140000-repair-notifications-reminder-index.js` | fixes a **pre-existing** bug that made the registration bell notifications fail (§7) |

Both are MySQL-only, self-contained, and **skip objects that already exist**,
because the app's startup `sequelize.sync()` may already have added the
columns from the model. Superadmin needs no grant (`*:*`).

### `companies` columns

| Column | Type | Notes |
|---|---|---|
| `registration_status` | ENUM(`pending`,`approved`,`rejected`) NOT NULL, default `approved` | indexed |
| `registration_submitted_at` | DATETIME NULL | set on registration; backfilled from `created_at` |
| `registration_reviewed_by` | INT NULL | `users.id` of whoever decided last |
| `registration_reviewed_at` | DATETIME NULL | time of the last decision. NULL for companies that existed before the migration, so the app shows "Active" with no "since" date |
| `registration_rejection_reason` | TEXT NULL | reason for the last reject / deactivate (≤ 1000 chars). Cleared on approve / activate |

A company has no `association_id` column. **Its association is its users'
`users.association_id`**, the same rule the association stats use.

## 4. Permissions

| Permission | Who | Allows |
|---|---|---|
| `registration:approve` | `association` role (migration), superadmin (`*:*`) | list, view, approve, reject, deactivate, activate |

Per-record scope is checked by `policies/registrationPolicy.js`:

- An association user may act only on companies whose owner has the **same
  `association_id`**.
- A superadmin may act on all of them, including companies with no association.
- The list is scoped in `registrationService.scopeWhere(user)` with a
  `users.association_id` subquery.

**Users must log in again** after the migration to receive the new permission.

## 5. API — `/api/registrations`

Every route: `authenticate → authorize("registration:approve")`.

| Method & path | What | Notes |
|---|---|---|
| `GET /` | list | `status` = `pending` (default) \| `approved` \| `rejected` \| `all`, `search` (company, company email, owner name / username / email), `page`, `per_page` (≤ 100). Pending lists oldest first, the others latest decision first. Response adds `counts: { all, pending, approved, rejected }` |
| `GET /pending-count` | `{ pending }` | used for the tab badge |
| `GET /:companyId` | one registration, with documents | 403 if from another association |
| `POST /:companyId/approve` | → `approved` | Approve and Activate share this route |
| `POST /:companyId/reject` | → `rejected` | body `{ reason }`, required, ≤ 1000 chars. Reject and Deactivate share this route |

Responses go through `serializers/registrationSerializer.js`:
`company_id, company_name, status, submitted_at, waiting_days, reviewed_at,
reviewed_by, rejection_reason, association {id,name}, owner {id,name,username,email},
company {address, location, postcode, email, contact_no, total_fulltime_staff,
total_partime_staff}`, plus `documents` on the detail only.

`waiting_days` is still sent, but the app no longer shows it.

## 6. Where the status is enforced

| Place | File | Effect |
|---|---|---|
| Registration | `services/authService.js → registerOperator` | `association_id` required: 400 "Sila pilih persatuan anda / Please choose your association." Company created `pending`. After commit, `registrationService.notifyApprovers()` runs; a failure there is logged and doesn't fail the registration. |
| Re-registering with a taken username / email | `authService.duplicateRegistrationError` | 409 that says the registration is still waiting, or that the account is inactive, instead of only "already exists" |
| Login | `authService.loginFromUnifiedUsers` | **403** with `code` `REGISTRATION_PENDING` / `REGISTRATION_REJECTED` and `reason`. `authController.login` spreads `error.meta` into the JSON |
| Every authenticated request | `services/sessionService.js → loadFromUsers` | **401** `SessionInvalidError(message, code)`: a user signed in before a reject or deactivate is signed out on the next request |
| Company pickers (packages, quotations) | `services/companyService.js` | only `approved` companies are listed |
| Quotation items | `services/quotationService.js → normalizeItems` | 400 if an item's company isn't approved |
| Association statistics | `services/dashboardService.js` | staff and company figures count `approved` companies only |

## 7. Notifications & emails

**Bell** (`registrationService.notifyApprovers`):
- One `notifications` row per active association user of the owner's
  association, plus one per superadmin.
- Fields: `type: "registration_pending"`, `related_id: company id`,
  `user_type: "operator"`.
- The bell shows only `message`, so it carries everything:
  "Pendaftaran baharu / New registration: <company> (<owner name — username>)".
- When the company is decided, its unread notifications are marked read.
- There is **no email to the association**; the bell is the only alert.

The bulk insert used to fail on databases that ran the *first* version of
`20260518000001-add-unique-index-to-notifications`. MySQL dropped that
migration's `where`, leaving a table-wide unique key on
`(type, related_id, created_at)`, so several approvers notified in the same
second collided. `20261030140000` replaces it with the intended reminder-only
index (generated column `reminder_dedupe_key`). Databases that already have the
fixed index are left alone.

**Emails to the operator** (`services/emailService.js`). Sent to the owner's
email (else the company email), **not awaited** (Gmail SMTP takes ~4 s), and
errors are only logged:

| Decision | Method | Subject |
|---|---|---|
| Approve / Activate | `sendRegistrationApprovedEmail` | Pendaftaran RuTEC diluluskan / RuTEC registration approved (with the login link) |
| Reject (from pending) | `sendRegistrationRejectedEmail` | Pendaftaran RuTEC ditolak / RuTEC registration rejected (with the reason) |
| Deactivate (from active) | `sendCompanyDeactivatedEmail` | Akaun RuTEC tidak aktif / RuTEC account deactivated (with the reason) |

- Which email a reject sends depends on the status before the decision:
  `decide()` returns it as `previousStatus`.
- The login link is the first `CORS_ORIGIN` value + `/login`, so **set
  `CORS_ORIGIN` to the real `https://` site** on each server.

## 8. SMTP configuration

The sender comes from `.env` (read at startup only, so restart after a change):

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=rutecsabah@gmail.com
SMTP_PASS=<Gmail app password, 16 chars, no spaces>
SMTP_FROM="RuTEC Sabah <rutecsabah@gmail.com>"
CORS_ORIGIN=https://<the real site>
```

- Gmail only sends as the logged-in account, so `SMTP_FROM` must use the
  `SMTP_USER` address.
- Mail from a free Gmail address can land in spam. For reliable inbox delivery,
  send from `noreply@rutec.my` through a transactional provider (e.g. Brevo),
  with SPF, DKIM and DMARC on the `rutec.my` DNS. Only `.env` changes; no code
  change is needed.

## 9. Files

| File | Role |
|---|---|
| `migrations/20261030130000-add-registration-approval.js` | columns, index, permission |
| `migrations/20261030140000-repair-notifications-reminder-index.js` | notifications index repair |
| `models/companyModel.js` | `registration_*` fields |
| `utils/registrationHelpers.js` | statuses, codes, `registrationBlock(company)`, `daysSince` |
| `services/registrationService.js` | scope, list, counts, detail, `decide` (row lock), approve / reject, bell, emails |
| `controllers/registrationController.js`, `routes/registrationRoutes.js`, `server.js` | API, mounted at `/api/registrations` |
| `policies/registrationPolicy.js`, `policies/index.js` | same-association rule, `POLICY_MAP.registration` |
| `serializers/registrationSerializer.js` | API shape |
| `services/authService.js`, `controllers/authController.js` | register as pending, login block, duplicate message |
| `services/sessionService.js` | sign out blocked companies on the next request |
| `services/emailService.js` | the three operator emails |
| `services/companyService.js`, `services/quotationService.js`, `services/dashboardService.js` | hide / refuse companies that aren't approved |

## 10. Tests

- **Unit:** `tests/unit/routes/registrationRoutes.test.js` (7). Covers
  `registrationBlock`, `daysSince`, the permission check, cross-association
  403, superadmin access, reason required, and serializer shape. Whole suite:
  **336 pass** (2026-11-02).
- **Functional QA** against a local server and MySQL, run from scripts outside
  the repo:
  - Registration API: 47/47.
  - Browser: 30/30 (2026-10-30).
  - Full Pending → Approve → Deactivate → Activate flow in the browser, with
    login checked after each step: 14/14 (2026-11-01).
  - A user signed in during deactivation: 200 before, 401 `REGISTRATION_REJECTED`
    after (2026-11-02).
- The migrations were run locally. The notifications repair was needed on the
  local DB, which still had the old index.

## 11. Deploy

1. Backend first: `npx sequelize-cli db:migrate` runs both migrations. Existing
   companies become `approved` and nothing changes for them.
2. **Association users log in again** to get `registration:approve`.
3. In each server's `.env`, set `SMTP_*` and `CORS_ORIGIN` (§8), then restart.
4. Frontend / Android build (see the frontend doc).

## 12. Known limitations / follow-ups

- No email to the association on a new registration; the bell only. Easy to
  add with `notifyApprovers`' recipient list.
- A decision only records the **last** reviewer, time and reason. There is no
  history table.
- `waiting_days` is still in the API but not shown.
- `docs/design/REGISTRATION_APPROVAL_PLAN.md` and its mockups describe the
  original design (§ top). They can be removed, as the quotation mockups were.
