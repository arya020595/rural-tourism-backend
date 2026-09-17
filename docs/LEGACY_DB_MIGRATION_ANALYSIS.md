# Legacy Database Migration — Technical Analysis

**Source (old system):** `dump-rural_tourism-202609041538.sql` (MySQL 8.0.46, host `46.202.163.155`, db `rural_tourism`, taken 2026-09-04)
**Target (production):** `dump-rural_tourism-202609041651.sql` (same host, 154 MB, taken 2026-09-04 16:51)
**Date:** 2026-09-04

---

## 1. Source (old) schema

The dump contains **only 4 tables**. There is no RBAC, no companies, no associations, no
tourist accounts — the old system was a single-role operator app.

| Table | Rows | PK | Purpose |
|---|---:|---|---|
| `rt_user` | 64 | `user_id` varchar `U########` | Operator login accounts |
| `activity` | 284 | `activity_id` varchar `act_########` | Activity products |
| `accomodation` | 94 | `homest_id` varchar `acc_########` | Homestay/accommodation products |
| `form_responses` | 2,241 | (`receipt_id`, `user_id`) | E-receipts / bookings |

```
rt_user        (user_id, username, user_email, password, full_name,
                securityQ1, securityQ2, business_name)
activity       (activity_id, activity_name, location, user_id, createdAt, updatedAt)
accomodation   (homest_id, homest_name, location, user_id, createdAt, updatedAt)
form_responses (receipt_id, user_id, citizenship, pax, activity_name, homest_name,
                location, activity_id, homest_id, total_rm, total_night, package,
                issuer, status, date, createdAt, updatedAt)
```

Note: **no foreign keys are declared anywhere** in the dump — all relationships are by
convention only, which is why orphans exist (§4).

### Semantic notes

- `rt_user.full_name` is **not a person's name** — it is the *business / operator name*
  (e.g. "Murug Turug Eco Tourism"). `rt_user.username` holds the person's name.
  `business_name` exists as a column but is NULL for all 64 rows.
- `form_responses` is a **denormalised e-receipt**: it stores both the FK
  (`activity_id` / `homest_id`) and a snapshot of the name (`activity_name` / `homest_name`).
- A `form_responses` row is exactly one of three shapes, mutually exclusive:
  - **activity** — `activity_id` set (1,459 rows)
  - **accommodation** — `homest_id` set (598 rows)
  - **package** — both IDs empty, JSON legs in `package` (184 rows)
  - rows with *both* IDs = 0, so the discriminator is unambiguous.
- `package` JSON leg shape: `[{ id, total_rm, packageDesc, nameOfBusiness }, ...]`
- `citizenship` is a 2-value enum in Malay: `Warganegara` (1,967) / `Bukan Warganegara` (274).
  **Must be converted** to the current vocabulary on migration — see §3.
- `pax` is a **single total** — the old system did not split domestic vs international.
- `status`: `Active` (2,081) / `void` (160).
- `issuer` is the free-text name of the person who issued the receipt. It maps directly to
  `bookings.operator_name` (§5).
- `total_rm` and `total_night` are declared varchar but are 100% numeric-clean
  (verified: 0 non-numeric values).

---

## 2. Target (current) schema — the relevant slice

The current system is substantially richer: RBAC, associations, companies, normalised products.

```
associations (id, name, image, power_bi_url, ...)   -- 7 seeded, incl. KIULU TOURISM ASSOCIATION (KTA)
companies    (id, company_name, address, email, location, postcode, contact_no,
              logo / licence files)
users        (id, name, username, email, password, role_id, company_id, association_id, ...)
roles        (superadmin | operator_admin | operator_staff | tourist | association)
products     (id, company_id, name, product_type ENUM('activity','accommodation'))
bookings     (id, booking_type ENUM('activity','accommodation','package'), customer_type,
              tourist_full_name, citizenship, no_of_pax_antarbangsa, no_of_pax_domestik,
              product_id, product_name, activity_date, total_price, total_deposit,
              user_id, user_fullname, check_in_date, check_out_date, total_of_night,
              status, receipt_created_at, operator_name, company_id, company_name,
              phone_number, email, ...)
booking_package_companies (booking_package_id, referrer_id, referral_company,
                           referee_id, referee_company, description, per_price,
                           association_id)
```

There is also a **legacy `form_responses` table still present in the current schema**
([models/formModel.js](models/formModel.js), created by
[migrations/20260106000005-create-form-responses-table.js](migrations/20260106000005-create-form-responses-table.js)).
It is a v1.5 carry-over with integer FKs and a mandatory `tourist_user_id`.
**Do not migrate into it** — it is not the live booking model. `bookings` is
(see [services/bookingsService.js](services/bookingsService.js), `/api/bookings`).

---

## 3. Structural gaps — old → new

| Concern | Old | New | Impact |
|---|---|---|---|
| User ID | varchar `U########` | INT AUTO_INCREMENT | Needs an ID crosswalk for the whole migration |
| Product ID | varchar `act_` / `acc_########` | INT AUTO_INCREMENT | Same |
| Business entity | none (a string on `rt_user`) | `companies` table | Must **derive** companies from `rt_user.full_name` |
| Role | none (all users equal) | `roles` FK | All migrated users → `operator_admin` |
| Association | none | `associations` FK | All data is Kiulu → map to **KIULU TOURISM ASSOCIATION (KTA)** |
| Pax split | single `pax` | `no_of_pax_antarbangsa` + `no_of_pax_domestik` | Derive from `citizenship` |
| Citizenship vocabulary | `Warganegara` / `Bukan Warganegara` | `domestic` / `international` / `both` | **Must convert** — silent data corruption otherwise |
| Money | varchar `total_rm` | `DECIMAL(12,2) total_price` | Cast |
| Package legs | JSON blob | `booking_package_companies` rows | Restructure |
| Tourist identity | none | `tourist_full_name`, `phone_number`, `email` | **Not available** — leave NULL |
| Security questions | `securityQ1` / `securityQ2` | removed (`20260326103000`) | **Drop** |

### Company derivation — the key decision

64 users map to only **44 distinct** `full_name` values. "Murug Turug Eco Tourism" alone is
shared by **16 users**. So the correct model is:

> one `companies` row per distinct `full_name`, and N `users` rows pointing at it.

That matches reality (a business with many staff) and matches the current schema's intent.
Naive 1-user-1-company would create 16 duplicate "Murug Turug" companies.

Shared business names in the source: Murug Turug Eco Tourism (16), Dapako Hill – Lingga Eco
Tourism (2), Kiulu Tourism and Vacation Centre (2) — **excluded, see §8.10, not migrated** —
MonggiLand Waterfall (2), Revelation Resources (2) — **excluded, see §8.11, not migrated** —
Sobo Hiking (2) — **excluded, see §8.11, not migrated**.

**Caveat:** matching is on a trimmed string. Normalising case *and* whitespace is required, or
"Revelation Resources " vs "Revelation Resources" split into two companies.

### `operator_admin` vs `operator_staff` — per-company assignment (decided 2026-09-14)

Both roles exist and differ meaningfully — `operator_admin` can create/update/delete products and
manage users; `operator_staff` can only take bookings and issue receipts (verified against
`roles_permissions`). `rt_user` has no seniority/ownership field, so the split can't be read
directly off the old schema.

**Rule, as originally proposed:** within each shared company, the user with the most receipts (ties
broken by revenue) becomes `operator_admin`; the rest become `operator_staff`. For the 34
single-user companies, that one user is `operator_admin` by default — nobody else to be staff.

Checked first whether "earliest product created" could serve as a seniority proxy instead, and
initially dismissed it — for Murug Turug, 14 of 16 users created their initial catalogue within a
13-minute window on the same day (2025-04-22, product names re-typed independently — e.g. "Pakej
A/B/C/Ultra (Hiking)" appearing near-identically across accounts), consistent with a bulk
registration event, not organic usage.

**Superseded (2026-09-14): the receipt-volume rule was wrong for 2 of the 3 remaining shared
companies.** Team-confirmed ground truth overrides it — receipt volume measures who does the daily
booking work, not who owns/administers the business, and those turned out to be different people:

| Business | `operator_admin` (confirmed) | Note |
|---|---|---|
| Murug Turug Eco Tourism | **Collin** (`U08795414`) | 0 receipts, 5 products — **not** Bibiana Dianus (217 receipts), who is now `operator_staff` like the other 14 |
| MonggiLand Waterfall | **Rubby james@ enjim** (`U03025470`) | 0 receipts, 2 products — **not** MLET (6 receipts), who is now `operator_staff` |
| Dapako Hill – Lingga Eco Tourism | **Kait Lansangan** (`U09900016`) | **Team-confirmed the actual business owner** (2026-09-14) — happens to also match the receipt-volume heuristic (225 of 226 receipts), but that agreement is coincidental, not the basis for the assignment |

In hindsight, Collin and Rubby's product-creation timestamps (**2025-01-23**, the earliest date
anywhere in the 64-user dataset — every other user's earliest product is 2025-03-06 or later) were
the actual signal: they registered their businesses first and staff joined later, but the owners
then did little or no day-to-day booking themselves. Receipt volume tracked who runs the front desk,
not who owns the business — a distinction the data alone could not resolve, which is why this
needed direct confirmation rather than a heuristic.

~~Kiulu Tourism and Vacation Centre~~ and ~~Revelation Resources~~ are **excluded, not reassigned**
— confirmed dummy companies, see §8.10 and §8.11.

Checked whether reassigning admin affects the product-dedup step (§8.5): it does not, and does not
need to. Products belong to the **company**, not the user (§8.5's `products.company_id` is the only
owner link) — whichever user's row happens to survive the `LOWER(TRIM(name))` dedup has no bearing
on who is `operator_admin`. (For reference: Collin's 4 "Pakej" product names are unique to him, but
his 5th, plain "Hiking," does collide with 14 of the other 15 users' products — unsurprising, since
this is the same bulk-registration pattern already noted above. The collision count in §8.5 is
unaffected by this reassignment either way.)

**`Sobo Hiking` — RESOLVED, excluded (team decision 2026-09-14).** No longer just deferred: the
whole company confirmed dummy alongside Revelation Resources. See §8.11. (Note: at the time this
was first deferred, only "no signal to pick an admin" was known — not that the company itself was
fake. Superseded.)

### Username derivation

`rt_user.username` seeds **both** `users.name` and `users.username`. Verified safe:

- All 64 usernames are **unique**, and still unique after trim + lowercase — no dedup needed
  for the `users.username` UNIQUE constraint.
- Max length 23, well inside `VARCHAR(255)`; all pass `userValidator`'s only rule, `min(3)`.
- No leading/trailing whitespace.

Two cosmetic consequences, neither a blocker:

- **36 of 64 contain a space** (e.g. `Kait Lansangan`, `david bin gungkit`) — because in the old
  system `username` was a person-name field, not a login handle. Login still works:
  [services/authService.js](services/authService.js) does a plain equality lookup on
  `username` OR `email` with no format constraint.
- **Login is case-sensitive** on both username and email
  ([authService.js:179](services/authService.js#L179), [:316](services/authService.js#L316)),
  and 48 of 64 usernames contain uppercase. Direct operators to sign in with their **email** at
  first login, and to reset the username afterwards if they want a cleaner handle.

### Citizenship conversion — mandatory, not cosmetic

Standardise the old Malay values onto the current vocabulary:

| Old value | Rows | → New value |
|---|---:|---|
| `Warganegara` | 1,967 | `domestic` |
| `Bukan Warganegara` | 274 | `international` |
| — | — | `both` (unreachable from old data) |

`both` denotes a mixed party split across the two pax columns. The old schema's single `pax`
field could not express that, so no migrated row can legitimately take it.

**Leaving the Malay values in place corrupts the display.** The frontend resolves the value with
an if/else chain that **falls through to `domestic`**
([booking-edit.page.ts:224-229](../rural-tourism-frontend/src/app/booking-edit/booking-edit.page.ts#L224-L229),
same in [booking-detail.page.ts:480-482](../rural-tourism-frontend/src/app/booking-detail/booking-detail.page.ts#L480-L482)):

```ts
citizenship === 'international' ? 'international'
  : citizenship === 'both' ? 'both'
  : 'domestic'
```

All 274 `Bukan Warganegara` bookings would silently render as **domestic** — wrong, not merely
untranslated. Conversion is required.

Two facts that make a data-only conversion sufficient:

- The backend **never validates or enumerates** citizenship — it only checks non-empty
  ([bookingsService.js:694](services/bookingsService.js#L694)). There is no ENUM and no
  allow-list to extend; the vocabulary lives entirely in the frontend.
- Comparison is `.toLowerCase()`-ed on read, so store the lowercase form.

**Unrelated pre-existing issue:** [seeders/20260430120000-seed-bookings.js](seeders/20260430120000-seed-bookings.js)
writes `citizenship: "Malaysian"`, which hits the same fallthrough. Out of scope for this
migration, but worth fixing separately.

---

## 4. Data-quality findings (all verified against the dump)

### Blockers — must be decided before writing the migration

| # | Finding | Count | Notes |
|---|---|---:|---|
| B1 | **Orphan `user_id`** referenced by products/receipts but absent from `rt_user` | **5 IDs** | `U01047249`, `U01262981`, `U04128926`, `U04677217`, `U09918731`. Users were deleted; their data was not (the old DB has no foreign keys). Full breakdown and recommendation in §8.4. |
| B2 | **Duplicate `receipt_id`** across different users | 1 (`PE3669068`) | Legal in the old schema (composite PK `receipt_id + user_id`). Only matters if the receipt number is carried over at all (Open Question 1); a non-unique column would sidestep it. |
| B3 | **Package `nameOfBusiness` doesn't match a company** | **1 leg** (was reported as 7 — that count compared raw strings) | Matching on *normalised* names (trim + collapse whitespace + lowercase) leaves only `'Dapako Hill'`, truncated from "Dapako Hill - Lingga Eco Tourism". A 1-entry alias map is enough. See §8.8. |

### Warnings — cleanable in-flight

| # | Finding | Count |
|---|---|---:|
| W1 | Corrupt dates: `0025-02-02` (PE3478546), `1999-02-01` (PE9216673) | 2 |
| W2 | `date` IS NULL on receipts | 163 |
| W3 | `issuer` empty → `operator_name` NULL (nullable, so fine) | 782 |
| W4 | Duplicate product names within the same user (case-insensitive) | 24 activity + 11 accom |
| W5 | Product-name collisions across users of the same business (real dupes once companies merge) | 78 |
| W6 | Invalid email `kenkenedy290@gmail` (no TLD) | 1 |
| W7 | Implausible `total_night` values (150, 160, 150) — almost certainly `total_rm` typed into the wrong field | 3 |
| W8 | Receipts referencing a `homest_id` that no longer exists in `accomodation` | 3 |
| W9 | Test accounts — enumerated with evidence in §8.7 | 4 clear + 2 borderline |
| W10 | 19 users have zero receipts; all 64 have at least one product | — |

### Good news

- Passwords are **all** bcrypt `$2b$` — directly portable, no forced password reset.
- Emails: 0 duplicates. Usernames: 0 duplicates.
- `total_rm` / `total_night`: 0 non-numeric values.
- `pax`: 0 zero/blank values.
- Zero orphan `activity_id` in receipts; only 3 orphan `homest_id`.
- Receipt name snapshots agree with the product tables (1 activity mismatch, 0 accommodation).
- `form_responses.user_id` always equals the product owner's `user_id` — no cross-tenant leakage.

---

## 5. What can be migrated

### Migrate in full

| Old | → New | Volume | Notes |
|---|---|---:|---|
| `rt_user.full_name` (distinct) | `companies` | **37** (40 minus Kiulu Tourism and Vacation Centre §8.10, Revelation Resources, Sobo Hiking §8.11) | `company_name` = full_name; `location` = 'Kiulu'; rest NULL |
| `rt_user` | `users` | **54** (64 raw − 4 test accounts §8.7 − 2 dummy-company users §8.10 − 4 dummy-company users §8.11) | `name` **and** `username` both = `rt_user.username`; `email` = user_email; `password` (bcrypt as-is); `role_id` = operator_admin; `company_id` derived; `association_id` = KTA. Users can change either later. |
| `activity` | `products` (`product_type='activity'`) | 267 raw after all exclusions → dedup further | `name` = activity_name, `company_id` via owner |
| `accomodation` | `products` (`product_type='accommodation'`) | 91 raw after all exclusions → dedup further | same |
| `form_responses` (activity/accommodation) | `bookings` (`booking_type='activity'`/`'accommodation'`) | ~2,044 combined, final | see §6 reconciliation for the exact split |
| `form_responses` (package) | `bookings` (`booking_type='package'`) + `booking_package_companies` | 167 receipts, 246 legs, final | `total_price` = SUM(legs.total_rm) |

**Field mapping for `bookings`:**

```
receipt_id                 → legacy_receipt_id (new nullable column — see §8.9, RESOLVED)
user_id (varchar)          → user_id (int, via crosswalk)
rt_user.username           → user_fullname
rt_user.full_name          → company_name
citizenship 'Warganegara'       → 'domestic'       + no_of_pax_domestik    = pax, antarbangsa = 0
citizenship 'Bukan Warganegara' → 'international'  + no_of_pax_antarbangsa = pax, domestik    = 0
                                  ('both' is unreachable from old data — see §3)
activity_id / homest_id    → product_id (via crosswalk)
activity_name/homest_name  → product_name
total_rm                   → total_price (DECIMAL cast)
total_night                → total_of_night
status 'Active'            → 'paid'       (old receipts were issued = paid)
status 'void'              → 'cancelled'
createdAt                  → created_at AND receipt_created_at
customer_type              → 'tourist' (constant; old system had no company customers)
issuer                     → operator_name    (free-text "Nama Pengendali/Operator Name")
location                   → implicit (association = KTA, company.location = 'Kiulu')
```

**Volume (final, post-§8 decisions incl. §8.10 and §8.11): 2,210 bookings, ~320 products after
dedup, 37 companies, 54 users.**

### Migrate with a decision required

| Item | Issue | Recommendation |
|---|---|---|
| Package legs | `nameOfBusiness` → `referee_id` INT NOT NULL, **1 leg** unresolved | 1-entry alias map: `'Dapako Hill'` → "Dapako Hill - Lingga Eco Tourism". `referrer_id` = the receipt's own operator; `association_id` = KTA. See §8.8. |
| Orphan-owned data (B1) | 5 unknown user IDs — 18 products, **4 receipts, RM 960** | See §8.4. At 0.2% of receipts the earlier "preserve via synthetic operator" recommendation is overweighted; dropping is defensible. |
| Duplicate receipt (B2) | `PE3669068` × 2 | Depends on Open Question 1. If carried over, prefer a non-unique column — suffixing would corrupt the printed IDs customers hold. |
| `void` receipts (160) | Historical cancellations | Migrate as `status='cancelled'` — dropping them corrupts the audit trail. |
| Corrupt dates (W1) | 2 rows | Fall back to `createdAt` (2025-10-11, 2025-12-31). |
| Test accounts (W9) | 4 clear + 2 borderline | Exclude by **explicit user_id list** (§8.7) — never by pattern match. All 4 have zero live revenue. |

### Cannot / should not migrate

| Item | Why |
|---|---|
| `securityQ1` / `securityQ2` | Column removed deliberately in `20260326103000-remove-legacy-security-columns-from-rt-users.js`. Replaced by email password reset. |
| `business_name` | 100% NULL. |
| Tourist identity on bookings | Old system never captured `tourist_full_name`, phone, or email. Migrated bookings get `customer_type='tourist'` with NULL contact fields. |
| `location` (per-row) | Redundant — 2,056 / 2,241 are 'Kiulu', 184 blank, 1 'Kedamaian'. Superseded by company/association. |
| Company profile detail | Old schema has no address, postcode, contact_no, logo, or licence files. Operators must fill these in post-migration. |
| Product pricing | Old `activity` / `accomodation` carry **no price** — price only ever existed per-receipt. New `products` has no price column either, so nothing is lost, but products land price-less. |
| `total_deposit`, `phone_number`, `email` on bookings | Not present in source. |
| Roles / permissions / associations | Already seeded in the target; nothing to import. |

---

## 6. Recommended migration order

```
1. Pre-flight   Snapshot target DB. Build & review the alias map for B3.
2. Crosswalk    CREATE TABLE legacy_id_map (entity, legacy_id VARCHAR, new_id BIGINT)
                — keeps the migration re-runnable and auditable.
3. Companies    INSERT DISTINCT normalised full_name → companies
4. Users        rt_user → users (role=operator_admin, association=KTA, company via step 3)
5. Products     activity + accomodation → products
                (dedup on company_id + LOWER(TRIM(name)))
6. Bookings     form_responses activity/accommodation → bookings
7. Packages     form_responses package → bookings + booking_package_companies
8. Verify       Row counts, SUM(total_price) reconciliation, orphan-FK check
```

**Reconciliation targets — final, post-§8 decisions including §8.10 (corrected 2026-09-14, against
the refreshed dump `dump-rural_tourism-202609141032.sql`).** These figures supersede two earlier
drafts: the original raw-dump totals (64 users / 44 companies / 2,241 bookings), and an intermediate
correction that predated the Kiulu Tourism and Vacation Centre exclusion (§8.10). Because this is a
**merge into a populated database** (§8), these are also **deltas against a pre-migration baseline**,
not absolute final counts. Capture `COUNT(*)` for every affected table *before* the run and assert
`after - before`:

- Users: **54** (64 raw − 4 excluded test accounts §8.7 − 2 dummy-company users §8.10 − 4
  dummy-company users §8.11)
- Companies: **37** distinct (44 raw − 4 that belonged solely to an excluded test account − 1 for
  Kiulu Tourism and Vacation Centre §8.10 − 2 for Revelation Resources and Sobo Hiking §8.11)
- Products: 358 raw (267 activities + 91 accommodations, minus everything owned by
  excluded/dropped/dummy users) → dedup further within that set, ~320 estimated
- Bookings: **2,210** (2,270 raw in the refreshed dump, minus 4 test-account receipts, 4
  dropped-orphan receipts, 51 Kiulu Tourism receipts, and 1 Revelation Resources receipt — Sobo
  Hiking contributed 0) — **2,077 paid + 133 cancelled**
- Total pax (**paid bookings only** — see correction below): **32,078**
- Revenue, non-package (paid only): **RM 890,749.99**
- Revenue, package (paid only): **RM 56,243.00**
- Combined (paid only): **RM 946,992.99**

**Correction (2026-09-15):** an earlier version of these targets summed pax and package revenue
across *all* statuses (33,687 pax, RM 81,748.00 package revenue, RM 972,497.99 combined) — this
double-counted `void`/cancelled package transactions as if they were real, collected revenue.
Caught by comparing the migrated data directly against the live association dashboard
([services/dashboardService.js](services/dashboardService.js) `getAssociationStats`), which
correctly scopes every figure to `status = 'paid'` — traced to the cent (RM 25,505.00 = the exact
value of voided package legs) before concluding the dashboard, not the migration, was right. The
figures above are the corrected, paid-only targets and match
[scripts/verifyLegacyKiuluMigration.js](../scripts/verifyLegacyKiuluMigration.js) exactly. Row
counts (users/companies/bookings/paid/cancelled split) were unaffected — only pax and revenue
needed correcting, since those are the only two aggregates the earlier version computed across all
statuses instead of paid-only.

⚠ These are recomputed from the *refreshed* dump (2026-09-14), which itself differs slightly from
the original snapshot the rest of this document was written against (§8's double-check found 29 new
receipts and 5 new products accrued in the interim — all attributable to real, already-accounted-for
operators). **Before running the actual migration, regenerate these numbers one final time against
whatever dump is used as the literal input** — do not trust this snapshot as final.

### Per project conventions ([CLAUDE.md](CLAUDE.md))

- Target MySQL only — no partial indexes, no `addIndex(..., { where })`.
- The migration must **seed anything it depends on** (KTA association, `operator_admin` role) via
  `INSERT ... ON DUPLICATE KEY UPDATE` rather than assuming a seeder ran first.
- [tests/setup.js](tests/setup.js) uses `sequelize.sync()` and never runs `migrations/**`, and CI's
  `migration-check` runs against a *clean* DB — **neither will catch this migration failing on real
  data**. Test against a MySQL 8.0 container loaded with this exact dump plus a realistic target DB.

---

## 7. Open questions for the team

1. ~~**Do we keep `receipt_id`?**~~ — **RESOLVED (2026-09-14):** yes, via a new
   `legacy_receipt_id VARCHAR(255) NULL` column on `bookings`. See §8.9 for the full decision,
   including how it changes the booking-detail *display* without changing the URL.
2. ~~**Is this a merge or a fresh load?**~~ — **ANSWERED: this is a MERGE.** The target already
   holds production data. See §8 for what this changes — it is the single most consequential
   constraint on the migration.
3. ~~**Citizenship values**~~ — **RESOLVED:** convert to `domestic` / `international` (§3).
   Required, not optional: the UI silently falls through to `domestic` otherwise.
4. ~~**Orphaned data (B1)**~~ — **FULLY RESOLVED.** Confirmed by the team: "Walai Dapako" and
   Dapako Hill are the same company. `U01047249` reattaches to Dapako Hill – Lingga Eco Tourism
   (3 receipts, RM 860, 14 products — deduped against Dapako's existing catalogue). All 4 remaining
   orphans (`U01262981`, `U04677217`, `U09918731`, `U04128926`) are dropped — see §8.6.
5. **Are the ~4 test accounts safe to exclude?** — **YES, identified in §8.7.** All four have
   **zero live revenue**. Two borderline cases (`dive ru`, `Shaheera123`) — **team decision
   (2026-09-14): leave them, do not exclude.** Neither has any receipts either way, so keeping
   them costs nothing; migrate as ordinary users. **Separately, three more whole companies were
   confirmed dummy after this decision and excluded**: "Kiulu Tourism and Vacation Centre" (2
   users, 51 receipts, §8.10), "Revelation Resources" and "Sobo Hiking" (4 users combined, 1
   receipt total, §8.11).
6. ~~**Package referrer/referee semantics**~~ — **RESOLVED (§8.8): no mismatch.** The current
   table is a per-line cost breakdown, not a referral chain, and self-referencing rows
   (`referee_id = referrer_id`) are already normal in production. The old JSON maps directly.
   **B3 also shrinks from 7 unresolved names to 1.**

### Resolved — the form-response discussion (2026-09-14)

7. ~~**What happens to the legacy `form_responses` table itself?**~~ — **RESOLVED: leave it,
   untouched.** See §8.9 for what it turned out to actually be, and why dropping it was the wrong
   call.

8. ~~**Does `receipt_id` survive the migration?**~~ — **RESOLVED: yes, via `legacy_receipt_id`.**
   See §8.9.

---

## 8. Merge constraints — the target is a populated production database

> **Note on ordering:** subsections below are numbered by topic, not by their position in the file.
> §8.9 appears *before* §8.8 physically (an artifact of incremental edits) — if reading top to
> bottom, be aware §8.8 (package semantics) is the last subsection, after §8.9
> (receipt IDs / `form_responses`) and §8.7 (test accounts).

**Confirmed:** this is a **merge**, not a fresh load. The target `rural_tourism` database already
holds production data (operators, companies, products, bookings). This is the single most
consequential constraint on the migration and it invalidates any "insert everything" approach.

### Why this matters

The old system's 64 operators are Kiulu businesses. The production database has already been
seeded with association accounts ([20260625000002-seed-association-accounts.js](seeders/20260625000002-seed-association-accounts.js)),
operator accounts, and bulk operator staff
([20260423100000-seed-operator-staff-bulk.js](seeders/20260423100000-seed-operator-staff-bulk.js)).

**The same real people and businesses may already exist in both systems.** A migration that blindly
inserts will either abort mid-run or silently duplicate live entities.

### Collision surfaces — verified against the schema

| Table | Constraint | Failure mode | Severity |
|---|---|---|---|
| `users` | **UNIQUE** on `username` *and* `email` ([create-unified-users-table.js:20,25](migrations/20260413093000-create-unified-users-table.js#L20)) | **Hard abort.** Any overlapping email/username stops the insert — potentially partway through the run. | Highest — will actually break the migration |
| `companies` | **No unique constraint** on `company_name` | **Silent duplication.** Creates a second "Murug Turug Eco Tourism" beside the existing one; products and bookings then split across two companies. No error raised. | Insidious — worse than a crash, because nothing surfaces it |
| `products` | **No unique constraint** (only a plain `company_id` index, [create-products-table.js:45](migrations/20260421100000-create-products-table.js#L45)) | Silent per-company duplication of activity/accommodation names. | Insidious |
| `associations` | UNIQUE on `name` ([dedupe-associations-and-add-unique-name.js:92-94](migrations/20260417114500-dedupe-associations-and-add-unique-name.js#L92-L94)) | Safe — KTA already exists; look it up, never insert. | Low |
| `bookings` | No natural key | Legacy bookings interleave into the live autoincrement ID space, permanently. | Design decision, not a failure |

The two silent cases are the real danger. A hard abort is loud and recoverable; a split company is
neither, and may not be noticed until reporting looks wrong months later.

### Required before any migration code is written

1. **Pre-flight overlap report.** For each of the 64 `rt_user` rows, check the target for an
   existing user by email *and* by username, and for an existing company by normalised
   `company_name`. Produce the match list for human review — do not auto-resolve.
2. **Decide the merge policy per entity**, once the overlap is known:
   - *Existing operator found* — link the legacy bookings to the existing user, or create a
     separate account?
   - *Existing company found* — attach to it, or keep the legacy business separate?
   - *Existing product with the same name* — reuse, or create a duplicate?
3. **Make the migration idempotent and resumable.** With a hard-abort risk on `users`, a partial
   run is a realistic outcome. The `legacy_id_map` crosswalk (§6 step 2) becomes essential rather
   than merely useful: it lets a re-run skip what already landed.
4. **Wrap each phase in a transaction** with an explicit rollback path, and dry-run against a
   restored copy of production — not an empty schema.

### Interaction with existing findings

- **Reconciliation (§6)** becomes delta-based: capture baseline counts before the run.
- **Company derivation (§3)** now has to match against *existing* production companies, not only
  deduplicate within the dump.
- **Test accounts (Q5)** matter more: inserting `test@123.com` into production is worse than
  leaving it in a legacy system.

### Pre-flight overlap report — COMPLETED

Run against `dump-rural_tourism-202609041651.sql`. **The overlap is negligible — the feared
silent-duplication scenarios do not materialise.**

#### Production baseline

| Table | Rows | Max ID |
|---|---:|---:|
| `users` | 112 | 130 |
| `companies` | 105 | 105 |
| `products` | 138 | 286 |
| `bookings` | 217 | 319 |
| `associations` | 7 | — |
| `rt_users` (legacy carry-over) | 38 | — |
| `form_responses` | 0 (empty) | — |

`bookings` max id = 319 corroborates the `/booking-home/detail/319` screenshot: this is the live DB.

#### Overlap results

| Check | Result |
|---|---|
| **Company name collisions** | **0 of 44.** No legacy Kiulu business exists in production — the 105 production companies are Kota Belud / Ranau / Kadamaian operators. The insidious silent-duplication risk **does not apply**. |
| **Username collisions** | **0 of 64.** |
| **Email collisions** | **2** — both *different people* sharing an address, not true duplicates (below). |
| **Product collisions** | **0** — no production product belongs to a KTA company. |

#### The 2 email collisions

| Email | Legacy | Production | Assessment |
|---|---|---|---|
| `outreachborneo@gmail.com` | June Baidin — "Outreach Borneo", **40 receipts**, 14 activities | id=76 Mejin Bin Maginggow — "Taburan Beach Camp", KOBETA | **Same owner, two businesses** in different districts/associations. Resolved — see §8.1. |
| `zana@stadvisory.com` | zana — "Zana", **0 receipts**, 1 activity | id=40 FARZANA — "ZANA TEST", RATA | Both test accounts. Resolved for free by the Q5 test-account exclusion. |

These two rows are the *only* ones that would abort the insert.

#### KTA is effectively empty — the plan is sound

Only **2 users** sit under KTA (`association_id=7`) today:

| id | role | company | note |
|---:|---|---|---|
| 103 | association (4) | — | KTA association admin account |
| 129 | operator_admin (2) | Arya Rifqi Pratama (105) | **0 products** |

Attaching all 64 legacy operators to KTA collides with nothing — it populates a district that is
currently unused. **Confirmed IDs for the migration: `associations.id = 7` (KTA),
`roles.id = 2` (operator_admin).**

#### Revised risk assessment

The §8 concerns were correct as risks but do **not** materialise in practice. The merge is close to
a clean insert into an unused association. Remaining actions:

1. Obtain a distinct email for the second (KTA) account — see §8.1.
2. Exclude the test accounts (Q5) — this also clears the `zana` collision.
3. Still make the migration idempotent and resumable, and dry-run against a restored copy. With
   only one genuine conflict the abort risk is low, but a 2,241-row insert should not be
   irreversible.

### 8.1 One owner, two businesses — `outreachborneo@gmail.com`

**Situation:** the owner runs two businesses in different districts under different associations —
"Taburan Beach Camp" (KOBETA, already in production as user id=76) and "Outreach Borneo" (Kiulu,
in the legacy dump with 40 receipts and 14 activities).

**The schema cannot represent one account in two associations.** `users.association_id` and
`users.company_id` are both single-valued FKs. The `association_users` table exists but is **empty
and unused** — all association scoping goes through `users.association_id`
([policies/userPolicy.js](policies/userPolicy.js#L68), [policies/associationPolicy.js](policies/associationPolicy.js#L11)).

Forcing one account to cover both would break two code paths:

- [bookingsService.js:440-451](services/bookingsService.js#L440-L451) **throws HTTP 400** when a
  company resolves to more than one `association_id` ("Company with id X has multiple
  association_id values").
- [dashboardService.js:474](services/dashboardService.js#L474) collapses ambiguity with
  `MIN(association_id)`, so the business would be **silently reported under the wrong association**.

#### Resolution — two accounts, two companies (matches existing production convention)

| | Production (existing) | Legacy (to migrate) |
|---|---|---|
| User | id=76 Mejin Bin Maginggow | **new account** |
| Email | `outreachborneo@gmail.com` | **needs a distinct address** |
| Company | Taburan Beach Camp (id 75) | **Outreach Borneo** (new) |
| Association | KOBETA (1) | **KTA (7)** |
| Bookings | existing | the 40 legacy receipts |

This is not a workaround — **production already models multi-business owners exactly this way.**
Eight owners currently hold multiple accounts, including two that span associations:

| Owner | Business / association |
|---|---|
| `norulbahiah` | "Norul ABC" (KOMTDA, id 38) + "Norul Enterprise" (RATA, id 128) |
| `arya pratama` | "Yaritama" (KATA, id 45) + "Arya Rifqi Pratama" (KTA, id 129) |
| `azizul bin budiman` | two businesses, both KOBETA |
| `reynilda tiam` | three accounts, one company |

Every one uses a **separate email per account**. Keeping the businesses separate is also what makes
per-association dashboards and revenue reporting correct — merging them would misattribute Kiulu
revenue to KOBETA.

**Also verified:** 0 companies in production currently span more than one association, so the 400
path above has never been triggered. Modelling June as two accounts preserves that invariant.

#### Can the two accounts share the email? — **No.**

Asked directly: KTA account with company "Outreach Borneo" but the *same* email. This fails at two
independent levels.

**1. The database rejects it.** `users` carries `UNIQUE KEY `email` (`email`)`. A second row with
`outreachborneo@gmail.com` returns **ERROR 1062: Duplicate entry** and the INSERT fails — the
migration aborts at that record. A different *company name* does not help: the constraint is on
`users.email` alone, and there is no composite key pairing email with company or association.

**2. Even without the constraint, login would break.**
[authService.js:303-308](services/authService.js#L303-L308) resolves the account with `findOne`:

```js
const user = await UnifiedUser.findOne({
  where: { [Op.or]: [{ username: identifier }, { email: identifier }] },
});
```

`findOne` returns the **first** matching row and discards the rest, so the owner would always land
in whichever row MySQL returns first, with no way to reach the other business. Distinct passwords
would not help either: the row is selected *before* `bcrypt.compare` runs, so the wrong row is
picked and login simply fails.

#### Getting the distinct email

1. **Ask the owner for a second address** — preferred; they will want login access to both businesses.
2. **Plus-addressing** (`outreachborneo+kta@gmail.com`) — Gmail delivers to the same inbox, giving
   one inbox and two logins. Works today, no schema change.
3. **Relaxing the `users.email` UNIQUE constraint** — **not advised.** It is load-bearing for login
   ([authService.js:307](services/authService.js#L307) resolves users by email); duplicate emails
   would make login non-deterministic.

### 8.2 Full duplicate sweep — is anything else affected?

Every duplicate dimension checked across both datasets. **Only two blocking collisions exist, and
only one needs a decision.**

| Check | Result |
|---|---|
| Legacy → prod **email** (UNIQUE, blocks INSERT) | **2** — see below |
| Legacy → prod **username** (UNIQUE, blocks INSERT) | **0** of 64 |
| Legacy → prod **company name** (no constraint, silent dup) | **0** of 44 |
| Duplicate email *within* the legacy dump | **0** |
| Duplicate username *within* the legacy dump | **0** |

The 64 users → 44 businesses ratio is **not** duplication: staff sharing a company is the intended
model (§3).

#### The two email collisions

| Email | Legacy | Production | Status |
|---|---|---|---|
| `outreachborneo@gmail.com` | June Baidin / Outreach Borneo — **40 receipts** | id=76 Mejin, Taburan Beach Camp, KOBETA | **RESOLVED** — Taburan Beach Camp changes its email; legacy account migrates as-is. See §8.3 |
| `zana@stadvisory.com` | zana / "Zana" — **0 receipts** | id=40 FARZANA, "ZANA TEST", RATA | Test account on **both** sides. Excluded under Q5 — **collision disappears** |

**After excluding test accounts, June Baidin was the only account requiring action — now resolved (§8.3).**

#### Pre-existing production issues (NOT caused by this migration)

Found while sweeping; flagged for awareness only.

**8 owners already hold multiple accounts**, two spanning associations — corroborating that the
§8.1 two-account pattern is the established convention:

| Owner | Accounts |
|---|---|
| `arya pratama` | Yaritama (KATA) + Arya Rifqi Pratama (**KTA**) — spans associations |
| `norulbahiah` | Norul ABC (KOMTDA) + Norul Enterprise (RATA) — spans associations |
| `azizul bin budiman`, `airiel`, `komuniti`, `siti farizan…` | two businesses each, same association |
| `reynilda tiam` | 3 accounts on "Ulion Hill" — **verified normal**: id=90 `operator_admin` + id=91/92 `operator_staff`. Staff sharing a company, as intended |

**3 duplicate company names already in production** — the exact silent-duplication mode §8 warns
about, confirming the risk is real (`companies.company_name` has no unique constraint):

| Name | IDs |
|---|---|
| `denish` | 4, 100, 101 |
| `e2e test business sdn. bhd.` | 64, 65 |
| `datablu sdn bhd` | 67, 84 |

**Confirmed by the team as dummy/test accounts — no action needed.** The migration adds no new
company duplicates either: legacy↔production company overlap is zero.

### 8.3 Resolution — `outreachborneo@gmail.com`

**Decision (team):** ask **Taburan Beach Camp** (production user id=76) to update its email address.
Everything in the old database then migrates as **Outreach Borneo under KTA**, with no special
handling — the legacy account is treated exactly like the other 63.

**New address provided (2026-09-14): `enjoyborneoadventure@gmail.com`.**

| | Production (existing) | Legacy (to migrate) |
|---|---|---|
| User | id=76 Mejin Bin Maginggow (`operator_admin`) | new account, `operator_admin` |
| Email | `outreachborneo@gmail.com` → **`enjoyborneoadventure@gmail.com`** | `outreachborneo@gmail.com` (freed up) |
| Company | Taburan Beach Camp (id 75) | **Outreach Borneo** (new) |
| Association | KOBETA (1) | **KTA (7)** |
| Bookings | existing | the 40 legacy receipts |

#### ✅ Confirmed live in production (2026-09-14)

Confirmed by the team: `enjoyborneoadventure@gmail.com` is already live on production user id=76.
`outreachborneo@gmail.com` is free. **This was the last remaining blocker on running the migration —
it is now clear.**

(Note for context: this could not be independently re-verified from this session, since the
database connected here is a local/seeded copy — `id=76` resolves to a different, seeded test
account in it, not Mejin/Taburan Beach Camp. Taken on the team's confirmation.)

#### Worth confirming with the operator

The original address was named for the **Kiulu / Outreach Borneo** business but sat on the
**KOBETA / Taburan Beach Camp** account — so it likely belonged to the Kiulu business and was reused
during the KOBETA registration. Moving Taburan to `enjoyborneoadventure@gmail.com` leaves each
business on the email that actually matches it.

### 8.4 What "orphaned data" (B1) actually means

**Definition.** The old database declares **no foreign keys at all**. When a user account was
deleted, nothing cascaded to their products and receipts — those rows remained, still pointing at a
`user_id` that no longer exists in `rt_user`. Example: an `activity` row "Kayak" carries
`user_id = 'U04677217'`, but there is no such row in `rt_user`. The owner is gone; the data is not.

**Why it blocks the migration.** The target schema *does* enforce foreign keys —
`products.company_id` and `bookings.user_id` must reference real rows. Every orphan therefore needs
an owner or it cannot be inserted.

#### Full breakdown

| Missing user | Products | Receipts | Revenue |
|---|---:|---:|---:|
| `U01047249` | 14 | 3 (2 of them `void`) | RM 860.00 |
| `U04128926` | 1 | 1 | RM 100.00 |
| `U01262981` | 1 | 0 | — |
| `U04677217` | 1 | 0 | — |
| `U09918731` | 1 | 0 | — |
| **Total** | **18** | **4** | **RM 960.00** |

**Scale: 4 of 2,241 receipts (0.2%); RM 960 of RM 976,678 (0.1%).** Three of the five orphans have
no receipts at all — a single stray "Kayak" product each, most likely abandoned test data.

#### Revised recommendation

An earlier draft recommended a synthetic "Legacy Unknown Operator" to preserve revenue history.
**That was overweighted** — written before the volume was measured.

| Option | Cost |
|---|---|
| **Drop all 5** | Loses 4 receipts / RM 960. Reconciliation totals shift 0.1%. No operator can notice: the accounts do not exist. |
| **Synthetic operator** | Preserves them, but adds a permanent fake company under KTA, visible in every association dashboard and company list — for RM 960. |
| **Split** | Drop the 3 zero-receipt orphans (clearly junk); keep only `U01047249`. Even there, 2 of its 3 receipts are `void`, so the genuine preserved value is a single RM 120 receipt. |

**Superseded by §8.6.** Tracing the products by name identified the largest orphan as an earlier
Dapako Hill account, making *reattachment* better than either dropping or faking — it preserves the
audit trail without adding a phantom company.

### 8.5 FK rewiring — how products and bookings get their new owners

**Question:** when migrating `rt_user` → `users`, can the products' foreign keys be updated to point
at the new user and company?

**Company: yes, and it is mandatory. User: there is nothing to update — `products` has no
`user_id` column.**

```sql
CREATE TABLE `products` (
  `id` int NOT NULL AUTO_INCREMENT,
  `company_id` int NOT NULL,          -- the ONLY owner link
  `name` varchar(255) NOT NULL,
  `product_type` enum('activity','accommodation') NOT NULL,
  CONSTRAINT `products_company_id_foreign_idx`
    FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE
)
```

A product belongs to a **company**, not a person. This is deliberate and correct: the old model
("this Kayak belongs to user `U04677217`") does not survive, because all 16 Murug Turug staff share
one company and therefore one product catalogue — you do not want 16 copies of the same activity.

#### Resolution chain

```
rt_user.user_id (U########)
   └─ crosswalk ─→ users.id            (new INT)
                   users.company_id ──┐
                                      ↓
activity.user_id / accomodation.user_id
   └─ same crosswalk ─→ company_id ─→ products.company_id
```

The owner is *resolved through* the user but *stored as* the company. Step 5 of §6 becomes:

```sql
INSERT INTO products (company_id, name, product_type, created_at, updated_at)
SELECT m.new_company_id, a.activity_name, 'activity', a.createdAt, a.updatedAt
FROM legacy_activity a
JOIN legacy_id_map m
  ON m.entity = 'user' AND m.legacy_id = a.user_id;
```

#### Two consequences

**1. Dedup is required at this step.** When 16 staff collapse into one company, their separately
created products collapse too. Measured: 378 raw products contain **78 collisions** on
`(company, LOWER(TRIM(name)))`, landing at ~300. Without dedup, "Hiking" appears a dozen times
under one company.

**2. Bookings need a second crosswalk.** `bookings.product_id` must point at the *deduped* product,
so map each legacy `act_########` / `acc_########` to its new product id — where several legacy
products merged into one, all of them map to the same new id.

Unlike `products`, **`bookings` does carry both `user_id` and `company_id`**, so both links are set
there: `user_id` from the user crosswalk, `company_id` from that user's company. This is also why
the crosswalk table (§6 step 2) is load-bearing rather than merely convenient — three separate
inserts resolve against it.

### 8.6 Orphan identification — `U01047249` is very likely Dapako Hill

Tracing the orphaned records by product name identifies the largest orphan and changes the Q4
recommendation from "drop or fake" to **reattach**.

#### The 4 orphaned receipts (full IDs)

| receipt_id | user | Product | activity_id | Pax | Amount | Status | Created |
|---|---|---|---|---:|---:|---|---|
| `PE4803160` | `U01047249` | Camping | `act_02607626` | 12 | RM 120 | **Active** | 2025-03-10 |
| `PE6260655` | `U01047249` | Kayaking | `act_03360157` | 24 | RM 620 | `void` | 2025-03-06 |
| `PE9730358` | `U01047249` | Camping | `act_02607626` | 24 | RM 120 | `void` | 2025-03-06 |
| `PE6393108` | `U04128926` | Kayak | `act_08621701` | 2 | RM 100 | **Active** | 2025-04-23 |

Only **2 are Active** (RM 220 live; RM 740 voided). Note: 4 receipts across 5 orphaned users — three
orphans issued none.

#### The 18 orphaned products (full IDs)

**`U01047249`** — 11 activities + 3 accommodations, *all created 2025-03-06*:

| activity_id | name | | activity_id | name |
|---|---|---|---|---|
| `act_00583983` | Rafting | | `act_04963512` | flyingfox |
| `act_00870914` | abseiling | | `act_05904113` | Team Building |
| `act_02318958` | Picnic | | `act_06277839` | Abseiling |
| `act_02366263` | Hiking | | `act_06570817` | camping |
| `act_02607626` | Camping | | `act_08565645` | Flying Fox |
| `act_03360157` | Kayaking | | | |

Accommodations: `acc_00027455`, `acc_01872545`, `acc_08025185` — **all three named "Walai Dapako"**.

**The other four orphans** — one "Kayak" product each, zero receipts:

| user | activity_id | created |
|---|---|---|
| `U01262981` | `act_09266366` | 2025-12-19 |
| `U04128926` | `act_08621701` | 2025-04-23 |
| `U04677217` | `act_00203469` | 2025-04-28 |
| `U09918731` | `act_04946278` | 2025-05-01 |

#### Identification — re-checked against exact strings (2026-09-14)

**Correction to an earlier overstatement.** This was first described as "every distinctive product
... has a twin" — checked here against exact strings, and that framing was too strong. Dapako Hill's
real catalogue (`U09900016`) has **26 activities**, and only **7 overlap** with the orphan's 11:

| Match type | Names |
|---|---|
| Exact byte-for-byte | `Rafting`, `Abseiling`, `Picnic`, `Camping`, `Hiking`, `Team Building` (6) |
| Match after case/whitespace normalisation | + `flyingfox` ≈ `Flyingfox` (1 more → 7 total) |
| Orphan-only, no Dapako equivalent | `Kayaking`, `Flying Fox` (as two words) |
| Dapako-only, not in the orphan | `Wet Kitchen` (×5), `Hiking/Abseiling`, `BBQ`, `katering makanan`, `kampung walk`, `Lawatan sambil belajar`, `kayak`/`Kayak` (×3), and 3 more |

**These 6-7 overlaps are individually weak evidence.** They are generic activity names — "Hiking",
"Camping", "Rafting" — that any Kiulu operator could plausibly offer. Overlap here does not by
itself imply common ownership.

**The strong signal is narrower: "Walai Dapako" alone.** It is not a generic activity type but a
specific, distinctive place name, and it matches **exactly** (same spelling, same capitalisation) in
both accounts — 3 rows under the orphan (`acc_00027455`, `acc_01872545`, `acc_08025185`), 2 rows
under Dapako Hill (`acc_02586168`, `acc_03561249`). It appears under no other user in the entire
64-user dataset. That is the actual basis for the identification — not the broader activity-name
overlap.

Dapako Hill also already holds **two** live accounts (`U09900016` Kait Lansangan, `U05858500` Marius
bin garilo), so a business that registered more than once fits the pattern — `U01047249` reads as a
plausible earlier, deleted attempt. Internal duplication within the orphan's own 11 products
(`abseiling`/`Abseiling`, `camping`/`Camping`, and "Walai Dapako" three times, all created the same
day 2025-03-06) is consistent with someone re-adding items and then abandoning the account — but is
not, on its own, evidence linking it to Dapako Hill specifically.

**Net assessment: suggestive, not conclusive.** One strong, specific match plus several weak,
generic ones — short of a full catalogue match. Confirmation from Dapako Hill or KTA is still
required before reattaching; do not treat the name overlap alone as settled.

#### Revised Q4 recommendation — reattach, don't drop or fake

| Orphan | Action | Rationale |
|---|---|---|
| `U01047249` | **Reattach to Dapako Hill – Lingga Eco Tourism** | 3 receipts (RM 860) land with the business that earned them. Its 14 products dedup against Dapako's existing catalogue — Rafting, Abseiling, Flyingfox, Team Building and Walai Dapako already exist, so little new product is created. |
| `U01262981`, `U04677217`, `U09918731` | **Drop** | One "Kayak" each, **zero receipts** — nothing transacted, no financial record to lose. |
| `U04128926` | **Drop** (team decision, 2026-09-14) | One "Kayak", one RM 100 Active receipt. "Kayak" is too generic to identify (unlike "Walai Dapako" for `U01047249`) and the amount is too small to justify further chasing. |

This preserves the audit trail *and* keeps the company list clean — strictly better than either the
"synthetic operator" or "drop everything" options in §8.4.

#### ✅ Confirmed — Q4 CLOSED for `U01047249`

**Team confirmation (2026-09-14): "Walai Dapako" and Dapako Hill are the same company.** This
settles the identification in §8.6 above — the "Walai Dapako" match was the strong, specific signal;
the broader activity-name overlap (Rafting, Hiking, Camping, etc.) was corroborating but weaker on
its own.

**Action:** reattach `U01047249` to **Dapako Hill – Lingga Eco Tourism** (the company derived from
`U09900016` / `U05858500`, §3). Its 3 receipts (RM 860) land with the business that earned them, and
its 14 products dedup against Dapako's existing catalogue during the §8.5 product-merge step —
`Rafting`, `Abseiling`, `Picnic`, `Camping`, `Hiking`, `Team Building`, and `Walai Dapako` already
exist there, so only the genuinely new items (`Kayaking`, `Flying Fox` as two words) add rows.

The 3 zero-receipt orphans (`U01262981`, `U04677217`, `U09918731`) are dropped regardless, as
before — one stray "Kayak" product each, nothing transacted.

**`U04128926` — RESOLVED, drop (team decision, 2026-09-14).** A single "Kayak" product
(`act_08621701`, created 2025-04-23) and one RM 100 receipt (`PE6393108`, 2025-04-24, 2 pax).
Unlike `U01047249`, "Kayak" is a generic name shared by several other operators, so there is no
distinctive string to trace an owner from — and at RM 100 the team judged it not worth chasing
further. **All B1 orphans are now resolved: reattach `U01047249`, drop the other four.**

### 8.7 Test accounts (Q5) — enumerated

#### The 4 clear cases — safe to exclude

| user_id | username | email | business | Products | Receipts | Evidence |
|---|---|---|---|---:|---|---|
| `U05339512` | `tester` | `test@123.com` | **test User** | 2 (`raft`, `Skiing`) | 7, **all `void`** | "Skiing" in tropical Kiulu; amounts RM 1, 1, 2, 22; every receipt voided |
| `U08812032` | `adsdasd` | `test@123.comss` | tester | 1 (`dasd`) | 0 | Keyboard mash throughout; malformed email (`.comss`) |
| `U01241029` | `mail.ehsan` | `mail.ehsan@e.com` | **dummybusiness** | 1 (`kayak`) | 0 | Self-declared dummy; fake domain `e.com` |
| `U08459140` | `zana` | `zana@stadvisory.com` | Zana | 1 (`kayak`) | 0 | Vendor domain; matches production "ZANA TEST" (id=40) |

**All four carry zero live revenue** — no financial record is lost. `tester` is the only one with
receipts at all, and all 7 are `void`: someone exercising the form, not serving customers.

Excluding `zana` also clears one of the two email collisions for free (§8.2).

#### Two borderline — team judgement

| user_id | username / email | business | Assessment |
|---|---|---|---|
| `U09860679` | `dive ru` / `dive@dive.com` | ru dive | 1 product "dive ru", 0 receipts. Throwaway-looking email, and Kiulu is a river/hiking district with no diving — but nothing *proves* it is a test. Weak either way. |
| `U05173361` | `Shaheera123` / `nurulshaheera02@gmail.com` | Shasha | 1 "Hiking" product, 0 receipts. ~~A second Shaheera account exists...~~ **Correction (2026-09-14):** the other Shaheera account (`U00555452`, `shaheera@stadvisory.com`) is under "Kiulu Tourism and Vacation Centre," which has since been confirmed **dummy** and excluded (§8.10) — so this is *not* a duplicate of a real staff member. Both `stadvisory.com` accounts (this one's sibling, and `zana@stadvisory.com` from the 4 confirmed test accounts) share a domain pattern worth noting for future reference. `Shaheera123` itself is still borderline on its own merits — 0 receipts, weak signal either way. |

**Team decision (2026-09-14): leave both, do not exclude.** Migrate them as ordinary users
alongside the other 58 (not 60 — see §8.10, two more users were removed after this decision).
Neither has any receipts, so the only cost of keeping them is one extra `companies` row each
("ru dive" and "Shasha") — low enough not to be worth chasing further.

### 8.9 The form-response discussion — receipt IDs and the old `form_responses` table

Two questions, deliberately held back until now because they overlap: whether the old `PE#######`
receipt numbers survive migration, and what to do with a table *already* in the current schema that
happens to share the name `form_responses`. Resolved together on 2026-09-14.

#### Q1 — `legacy_receipt_id`: decided

Add a new nullable column to `bookings`:

```sql
legacy_receipt_id VARCHAR(255) NULL
```

**Display rule:** if `legacy_receipt_id` is set, show it in place of the internal `id` wherever a
booking number is displayed (detail page heading, receipts, etc.) — the internal `id` is hidden for
that booking. If `legacy_receipt_id` is `NULL` (every native, non-migrated booking), display `id` as
today, unchanged.

**The URL does not change.** Routing stays on `bookings.id` exactly as now
(`/booking-home/detail/:id`) — only the *displayed* number swaps. This was an explicit decision:
the alternative (routing on the legacy id when present) would have meant two different ID schemes
in the same route parameter, which was rejected as unnecessary complexity for no real benefit.

Implementation touches three places, none of which have been built yet — this section is the
decision record, not the implementation:

1. **Migration:** `addColumn` on `bookings`, nullable, no unique index (§8's earlier note on B2
   still applies — a duplicate legacy receipt id must not collide, so this stays non-unique).
2. **`serialize()`** in [bookingsService.js](services/bookingsService.js) — add
   `legacy_receipt_id` to the response, and a derived `display_receipt_id` (or equivalent) that is
   `legacy_receipt_id ?? id` so the frontend doesn't have to reimplement the fallback.
3. **Search** — add `legacy_receipt_id` to the existing `Op.or` in the booking search so an
   operator can find a migrated booking by typing its old `PE#######` number.

#### Q7 — the *other* `form_responses` table: leave it alone

**What it actually is.** Not the legacy dump's table (that one migrates into `bookings` +
`booking_package_companies` as already planned in §5 — unaffected by this). This is a *separate*
table already present in the **current** production schema
([models/formModel.js](models/formModel.js)), from an earlier v1.5 version of this system, before
`bookings` existed. Confirmed empty in production — 0 rows.

**Why "just drop it" turned out to be wrong.** Row count alone is not evidence of being unused. The
`FormResponse` model is `require()`'d directly by live, mounted route code:

| File | Mounted at | Uses FormResponse for |
|---|---|---|
| [controllers/operatorBookingsController.js](controllers/operatorBookingsController.js) | `/api/operator-bookings` ([server.js:146](server.js#L146)) | LEFT JOIN to fetch `receipt_id` for v1.5 activity/accommodation bookings |
| [services/formService.js](services/formService.js) | `/api/form` ([server.js:135](server.js#L135), [routes/formRoutes.js](routes/formRoutes.js)) | `create`, `findOne`, `findAll` — the whole CRUD surface for this route |

Both sit inside a **larger, still-mounted v1.5 booking subsystem** — `ActivityBooking` /
`AccommodationBooking` models, `bookingActivityRoutes`, `bookingAccommodationRoutes`,
`operatorBookingsRoute`, `touristBookingsRoute`, and the services behind them
([services/bookingService.js](services/bookingService.js),
[services/accommodationService.js](services/accommodationService.js),
[services/operatorActivityService.js](services/operatorActivityService.js)). Dropping
`form_responses` — or its model — would break `require()` at startup for at least
`operatorBookingsController.js` and `formService.js`, regardless of whether the table held data.

**Decision: leave it exactly as it is.** No drop, no data migration into it (it holds nothing to
migrate), no code changes. Determining whether the *entire* parallel v1.5 subsystem is still
reachable from the frontend (i.e. whether `/api/operator-bookings`, `/api/form`,
`/api/activity-booking`, `/api/accommodation-booking`, `/api/tourist-bookings` are still called by
[rural-tourism-frontend](../rural-tourism-frontend)) is a separate, larger piece of work than this
migration and was explicitly not undertaken here. If that subsystem is ever retired, `form_responses`
retires with it as one part of that larger change — not in isolation.

#### ⚠ Exclude by explicit user_id list — never by pattern

**`U08367860` `SUZILAWATI` / `Awierah1234@gmail.com`** would be caught by a naive
`LIKE '%123%'` or `LIKE '%test%'` filter. It holds **13 receipts, 12 Active, RM 2,480** of genuine
Murug Turug hiking packages. Pattern matching would delete real revenue.

Equally, **do not filter on "zero receipts"**: 19 of 64 users have none, including `kiharo2019`
(15 products) and `Collin` (5). Those are real operators who built a catalogue but never issued a
receipt through the system.

```sql
-- The safe form: an explicit allow-list of exclusions.
WHERE user_id NOT IN ('U05339512','U08812032','U01241029','U08459140')
```

### 8.8 Package semantics (Q6) — no mismatch; the mapping is direct

An earlier draft worried that the old `package` JSON is a *cost breakdown for one operator* while
`booking_package_companies` models a *referral chain between two companies*. **Inspecting real
production rows shows that concern was unfounded.**

#### What the current table actually means

`referrer_id` is **constant within a booking** — it is the operator who issued it. `referee_id`
varies per line: the company **supplying that component**. Real production data:

```
Booking 46, issued by tawakal ent (41):
   tawakal ent → Kementerian Malaysia (39)   RM 555   "Hyatt Centric"
   tawakal ent → Kor SUKSIS UMS (1)          RM 300   "Rafting"
   tawakal ent → tawakal ent (41)            RM 200   "healing"    ← self-referencing
```

So it is a **per-line cost breakdown that records which company supplies each piece** — not a
referral chain. Crucially, **self-referencing rows already exist and are normal**
(`referee_id = referrer_id`), including one row explicitly labelled "Same company test".

#### The old data has the same shape

| Old JSON field | → `booking_package_companies` |
|---|---|
| `packageDesc` | `description` |
| `total_rm` | `per_price` |
| `nameOfBusiness` | `referee_id` (resolved to a company) |
| the receipt's own operator | `referrer_id` |
| — | `association_id` = KTA (7) |

#### Measured against the legacy dump — 184 receipts, 277 legs

| Pattern | Legs | Share | Maps to |
|---|---:|---:|---|
| `nameOfBusiness` == issuing operator | 226 | **81.6%** | `referee_id = referrer_id` (the existing self-reference pattern) |
| `nameOfBusiness` == a different business | 51 | **18.4%** | genuine multi-operator packages |

The cross-company legs are exactly what the table was built for:

```
PE7035183, issued by Kiulu Eco-Tourism:
   → KLK Lodge Ponohuon Kiulu   RM 120   "Tempat Penginapan"
   → Murug Turug Eco Tourism    RM 52    "Hiking Team A"
```

#### B3 corrected — 1 unresolved leg, not 7

The earlier "7 of 23 unmatched" compared **raw** strings. Matching on normalised names
(trim + collapse internal whitespace + lowercase) leaves exactly **one**:

| Unresolved | Legs | Fix |
|---|---:|---|
| `'Dapako Hill'` | 1 | Alias → "Dapako Hill - Lingga Eco Tourism" |

The rest resolve once normalised — `MURUG TURUG ECO TOURISM` is casing,
`Monggoluton River View  & Picnic Centre` a double space. Note `pusat Reakriasi Bambangan` and
`Pusat Rekreasi Bambangan Lama` are **genuinely different businesses**, both legitimate — do not
merge them.

#### ⚠ Same-association constraint must be enforced by the migration

[bookingsService.js:617-624](services/bookingsService.js#L617-L624) rejects a package whose
referrer and referee are in different associations. All 64 legacy operators land under KTA, so
every leg is intra-KTA and satisfies it — **but that validation lives in the service layer**. A
direct SQL migration bypasses it entirely, so the migration must assert the invariant itself rather
than assume it holds.

### 8.10 "Kiulu Tourism and Vacation Centre" excluded — confirmed dummy (2026-09-14)

**Team confirmation:** both users under this business — `Justin Umis` (`U03471116`,
`ktvc@gmail.com`) and `Shaheera` (`U00555452`, `shaheera@stadvisory.com`) — are dummy accounts.
The whole company is excluded from the migration.

#### Why this needed a careful look before acting

This reverses an earlier stance: the company was one of the 5 shared businesses with a
data-determined `operator_admin` (§3 — Justin Umis, on the strength of 43 of 51 receipts), and its
receipts totalled RM 7,538 across 51 transactions with real-looking product names (Kayak, Jungle
Trekking, Hiking, Rafting) and dates spanning 2025–2026 — not obviously fabricated from the data
alone. The exclusion is taken entirely on the team's direct knowledge, not re-derived from the dump.

#### Full removal scope

| Removed | Count |
|---|---:|
| Users | 2 (`U00555452`, `U03471116`) |
| Products | 6 activities |
| Receipts | 51 (31 Active, 20 `void`) |
| Revenue removed (Active, non-package) | RM 5,355.00 |
| Pax removed | 767 |
| Package-type receipts among the 51 | **15** |

#### The package-leg complication

15 of the 51 receipts were **packages** — meaning this dummy account was recorded as issuing
multi-leg bookings that named *other, real* businesses as legs (Kiharo Garden, RS Kamandus View,
Dapako Hill, Murug Turug, Sinopian RC, KLK Lodge Ponohuon Kiulu, and others). Some legs read as
plausible transactions at a glance (e.g. `PE0715760`: RM 300 Hiking to Kiharo Garden, RM 500
Rafting to RS Kamandus View); others are unambiguous test noise (`packageDesc` values of `"123"`,
`"test"`, `"rtyrtyrty"`, `"34535345534"`).

**Team clarification (2026-09-14):** the real-sounding legs are test data too — when testing the
package-booking feature, the dummy account's operators simply picked names of real companies off
the list rather than inventing fake ones. So `PE0715760` naming Kiharo Garden and RS Kamandus View
does **not** mean those businesses earned that revenue; it means a real company name was used to
exercise the form. This confirms the drop-all-15 decision was correct on the merits, not just as a
conservative default — there is no real leg being sacrificed among the 15.

**Decision (team, 2026-09-14): drop all 15 package receipts in full.** No reattachment to a
placeholder referrer is needed — none of the 15 represent real bookings for the businesses they
name.

#### Ripple effects applied elsewhere in this document

- **§3** — Justin Umis's `operator_admin` assignment for this company is void; the company itself
  is no longer migrated, so there is no admin to assign. (Two more shared companies — Revelation
  Resources and Sobo Hiking — were subsequently also excluded as dummy; see §8.11. Only 3 shared
  companies remain in the final migration set.)
- **§8.7** — the "second Shaheera account" note previously described `U00555452` as a real staff
  member's duplicate; corrected, since that account is now known to be dummy — see the note inline.
- **§8.8** — the worked package example previously cited `PE0715760` (issued by this company);
  replaced with `PE7035183` (Kiulu Eco-Tourism → KLK Lodge Ponohuon Kiulu + Murug Turug Eco
  Tourism), a clean example unaffected by this exclusion.
- **§5 and §6** — all volume and reconciliation figures updated to the final post-exclusion counts.

#### Final counts after this exclusion (see §6 for the full reconciliation)

Users: 58 (was 60). Companies: 39 (was 40). Bookings: 2,211 (was 2,233, against the refreshed dump).
Combined revenue: RM 972,587.99 (was RM 976,577.99).

*(These sub-totals are further revised in §8.11 — two more companies were excluded afterward.
See §6 for the final, current numbers.)*

### 8.11 "Revelation Resources" and "Sobo Hiking" excluded — confirmed dummy (2026-09-14)

**Team confirmation, same session as §8.10:** both remaining shared companies with a
data-determined admin assignment are also dummy. Whole companies excluded, same pattern as §8.10.

| Business | Users | Products | Receipts | Revenue removed | Package involvement |
|---|---|---:|---:|---:|---|
| Revelation Resources | `U01863056` Victor83, `U08056368` joslenny84 | 4 | 1 (Active) | RM 90.00 | None |
| Sobo Hiking | `U02275515` SOBO, `U03277513` sobo hiking | 2 | 0 | — | None |

Unlike §8.10, **neither business appears as a leg in anyone else's package receipt** — checked
directly against every package JSON in the dump, zero matches for either name. So this exclusion is
simpler: no ripple into other operators' revenue, no package-leg cleanup required.

#### Note on Sobo Hiking's earlier status

Sobo Hiking had previously been left **deferred, not excluded** (§3) — at that point the only known
issue was "no receipts on either side, so no signal to pick an `operator_admin`." That framing is
now superseded: the company itself is confirmed dummy, which resolves the deferred question by
removing it entirely rather than answering it.

#### Ripple effects applied elsewhere in this document

- **§3** — Revelation Resources' `operator_admin` assignment (Victor83) is void, for the same
  reason as Kiulu Tourism's. Sobo Hiking's deferred-admin note is superseded by this exclusion.
  Only **3 shared companies** remain in the final migration set: Murug Turug Eco Tourism, Dapako
  Hill – Lingga Eco Tourism, MonggiLand Waterfall.
- **§5 and §6** — volume and reconciliation figures updated to the final counts (see §6).
- [docs/COMPANIES_AND_USERS.md](COMPANIES_AND_USERS.md) — both company sections removed from the
  roster.

#### Final counts after this exclusion (see §6 for the authoritative, current reconciliation)

Users: 54 (was 58). Companies: 37 (was 39). Bookings: 2,210 (was 2,211). Row counts here are
unaffected by the §6 pax/revenue correction below — only the combined-revenue figure quoted at the
time (RM 972,497.99) has since been corrected to **RM 946,992.99 (paid only)** — see §6's
2026-09-15 correction note.
