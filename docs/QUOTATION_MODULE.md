# Sebut Harga / Quotation Module — Backend

As-built reference for the quotation module (branch `features/newfeatures29oct`,
2026-10-29 → 2026-10-30). The frontend side is documented in the frontend repo
at `docs/QUOTATION_MODULE_FRONTEND.md`; the change log for this branch is
`docs/debug/DEBUG_LOG_2026-10-30.md`.

> Stack and layering follow `CLAUDE.md`: route → `authenticate → authorize →
> asyncHandler(controller)` → controller (per-record policy, serializer) →
> service (all Sequelize, typed `AppError`s).

---

## 1. What it does

An operator prepares a **quotation** (price offer) for a customer before they
book: customer, pax, one or more activities / accommodations with dates and
prices, and notes & terms. The quotation is shared as a PDF. When the customer
agrees it is converted, through the existing booking endpoint, into either:

- **a booking** (`booked`, deposit paid later) — "Tempahan/Booking" button, or
- **a paid receipt** (`paid`, paid in full now) — "Resit/Receipt" button.

Quotations live in their own tables. They are never counted as revenue,
bookings, calendar days or statement lines — only the booking made from them is.

## 2. Statuses

| Stored | Shown as | How | Edit | Convert | Cancel | PDF |
|---|---|---|---|---|---|---|
| `sent` | Dihantar/Sent | set when the quotation is saved (no draft step) | ✅ | ✅ | ✅ | ✅ |
| `sent` + `valid_until` < today (MYT) | Tamat/Expired | **computed**, never stored | ✅ (to extend the date) | ❌ until extended | ✅ | ✅ |
| `accepted` | Diterima/Accepted | set when converted (same DB transaction as the booking) | ❌ | ❌ | ❌ | ✅ |
| `cancelled` | Dibatalkan/Cancelled | operator cancels | ❌ | ❌ | ❌ | ❌ |

- There is **no draft** status and **no delete** — a saved quotation has been
  shared; stopping it is a Cancel, which keeps the record.
- An expired quotation is **not** auto-cancelled: extending its valid-until date
  makes it `sent` again (customers often come back a few days late).
- "Today" is the **Malaysia** date (`utils/quotationHelpers.js → malaysiaToday`),
  whatever the server's timezone.

## 3. Database

### Migrations

| File | What |
|---|---|
| `migrations/20261029100000-create-quotations.js` | `quotations`, `quotation_items`, indexes, `quotation:*` permissions + role grants |
| `migrations/20261030100000-add-quotation-terms-to-companies.js` | `companies.quotation_terms` (company default notes & terms) |

Both are MySQL-only, self-contained (seed what they need) and **skip objects
that already exist** — the app's startup `sequelize.sync()` creates missing
tables/columns from the models, so a server that started before the migration
ran must not make the migration fail. Tested up → down → up locally, and with
the tables pre-created by `sync()`.

### `quotations`

| Column | Type | Notes |
|---|---|---|
| `id` | BIGINT PK | number shown is **`QT_` + id padded to 4** (`QT_0007`) — derived, not stored |
| `company_id` | INT FK → companies (CASCADE) | owner company |
| `created_by` | INT | user id |
| `prepared_by_name` | VARCHAR(255) NULL | typed on the form ("Disediakan Oleh"); not the login name |
| `customer_name` | VARCHAR(255) | |
| `phone_number` | VARCHAR(50) | ≥ 8 digits |
| `email` | VARCHAR(255) NULL | |
| `citizenship` | VARCHAR(100) | `domestic` / `international` / `both` |
| `no_of_pax_domestik`, `no_of_pax_antarbangsa` | INT | whole numbers ≥ 0, total ≥ 1 |
| `quotation_date` | DATE | default today (MYT); printed on the PDF |
| `valid_until` | DATE | default `quotation_date` + 7; ≥ `quotation_date` |
| `notes` | TEXT NULL | ≤ 5,000 chars; each quotation keeps its own copy |
| `status` | ENUM(`sent`,`accepted`,`cancelled`) default `sent` | |
| `total_amount` | DECIMAL(12,2) | sum of items, recalculated on every save |
| `booking_id` | BIGINT FK → bookings (**SET NULL**), **UNIQUE** | set on conversion |
| `sent_at`, `accepted_at`, `cancelled_at` | DATETIME NULL | |
| `created_at`, `updated_at` | DATETIME | list shows / filters by `created_at` |

Indexes: `idx_quotations_company_status`, `idx_quotations_company_date`,
`uq_quotations_booking_id` (unique — NULLs never collide).

### `quotation_items`

Same shape as `booking_package_companies`, so conversion is a straight copy.

| Column | Type | Notes |
|---|---|---|
| `quotation_id` | BIGINT FK (CASCADE) | |
| `sort_order` | INT | display order |
| `product_type` | ENUM(`activity`,`accommodation`) | |
| `company_id` / `company_name` | INT / VARCHAR | supplier company (= `referee_id`) + name snapshot |
| `product_id` / `description` | INT / TEXT | product + its name snapshot |
| `amount` | DECIMAL(12,2) | one amount per line (= `per_price`) |
| `activity_date` | DATETIME | activity; stored **as typed** (Malaysia wall-clock in UTC fields), like `bookings.activity_date` |
| `check_in_date`, `check_out_date` | DATE | accommodation; end > start |

### `companies.quotation_terms`

TEXT NULL. The company's saved default notes & terms; NULL = the app's
standard text. Changing it never alters quotations already saved.

## 4. Permissions

Seeded by the migration (section **"Quotation"** in Roles & Permissions):

| Code | Name | operator_admin | operator_staff |
|---|---|---|---|
| `quotation:read` | View Quotations | ✅ | ✅ |
| `quotation:create` | Create Quotation | ✅ | ✅ |
| `quotation:update` | Edit Quotation | ✅ | ✅ |
| `quotation:delete` | Cancel Quotation | ✅ | — |

Superadmin via `*:*`. Converting also needs the existing `booking:create`, and
Convert to Receipt also needs `receipt:create`.

`policies/quotationPolicy.js` — `index`, `show`, `create`, `update`, `cancel`,
`convert(mode)`, `scope()`. Records are visible to their **own company only**
(superadmin: all). Companies whose products are on someone else's quotation do
not see it; they see the booking once converted (existing referral visibility).

**Operators must log in again after the deploy** to receive the new permissions.

## 5. API — `/api/quotations`

| Method & path | Permission | Notes |
|---|---|---|
| `GET /` | `quotation:read` | `?page&per_page(≤100)&search&status=all\|sent\|accepted\|expired\|cancelled&created_from&created_to`; returns `data`, `meta`, `counts` |
| `POST /` | `quotation:create` | creates as `sent`; 201 |
| `GET /terms` | `quotation:read` | `{ terms }` — company default (null = standard) |
| `PUT /terms` | `quotation:create` | `{ terms }` — save (≤ 5,000 chars; blank clears) |
| `GET /:id` | `quotation:read` | with items, `booking_status`, `can_*` flags |
| `PUT /:id` | `quotation:update` | `sent` (incl. expired) only; items replaced |
| `POST /:id/cancel` | `quotation:delete` | `sent` only |
| `GET /:id/pdf` | `quotation:read` | inline `QT_0007.pdf`; 400 when cancelled |
| `GET /:id/booking-draft?mode=booking\|receipt` | `quotation:read` + convert policy | booking-shaped record to pre-fill the form; 409 if expired / accepted / cancelled |

Search matches customer name, phone, or the number (`QT_0007`, `qt7`, `QT-7`).
`created_from` / `created_to` are Malaysia days (`YYYY-MM-DD`, both included).
The list is ordered by `created_at DESC`.

### Create / update body

```jsonc
{
  "customer_name": "Aminah binti Ali",
  "phone_number": "0139876543",
  "email": "aminah@example.com",          // optional
  "citizenship": "both",                   // domestic | international | both
  "no_of_pax_domestik": 4,
  "no_of_pax_antarbangsa": 2,
  "quotation_date": "2026-10-30",          // optional, default today (MYT)
  "valid_until": "2026-11-06",             // optional, default +7 days
  "prepared_by_name": "Puan Rosnah",       // optional
  "notes": "1. ...",                       // optional, ≤ 5,000 chars
  "items": [                               // 1–30
    { "product_type": "accommodation", "company_id": 42, "product_id": 286, "amount": 600,
      "check_in_date": "2026-11-14", "check_out_date": "2026-11-16" },
    { "product_type": "activity", "company_id": 43, "product_id": 36, "amount": 270,
      "activity_date": "2026-11-16T07:00" }  // time optional; "as typed"
  ]
}
```

### Validation and business rules (`services/quotationService.js`)

- Name required (≤ 255), phone ≥ 8 digits, email format, citizenship value.
- Pax: whole numbers ≥ 0, total ≥ 1 (`"abc"`, `2.5`, `-1` refused).
- Dates must be **real calendar days** (`2026-02-30` refused — plain
  `new Date()` would roll it over to 2 March); `valid_until ≥ quotation_date`.
- Items: type, company, product and price > 0 required; activity needs a date;
  accommodation needs start and end, end after start.
- **At least one item must be the company's own product** — otherwise refer the
  customer to the other company directly.
- Every other company must be in the **same association** (same rule as package
  items).
- Each product must belong to that item's company, match the type, and be
  **active**. Product and company names are snapshotted.
- Errors are typed `AppError`s (`BadRequestError`, `NotFoundError`,
  `ForbiddenError`, `ConflictError`); messages for operators are bilingual.

## 6. Converting to a booking / receipt

Conversion reuses the **one booking path**; nothing writes bookings a second way.

1. App calls `GET /api/quotations/:id/booking-draft?mode=booking|receipt`.
   `buildBookingDraft()` returns a record in the `GET /api/bookings/:id` shape:
   - 1 item → `activity` or `accommodation` booking (always the company's own
     product, enforced on save);
   - 2+ items → `package` with `package_companies[]` (`referrer_id` = owner,
     `referee_id` = item company, `per_price` = amount, item type and dates);
   - `operator_name` = the quotation's `prepared_by_name`; deposit left empty;
   - `status` = `booked` (booking) or `paid` (receipt).
2. The operator checks the pre-filled Add Booking / E-Receipt form and submits.
   The app sends the normal `POST /api/bookings` (through the offline queue)
   with **`quotation_id`**.
3. `bookingsService.createBooking`, inside its existing transaction:
   - after the idempotency early-return, `quotationService.lockForConversion()`
     locks the quotation row (`SELECT … FOR UPDATE`) and checks company and
     status (`sent`, no booking yet) — 404 / 403 / 409 otherwise;
   - creates the booking (+ package items) as before;
   - `markAccepted()` sets `status = accepted`, `booking_id`, `accepted_at`;
   - commit — all or nothing.

Guarantees (all tested):
- A failed booking (e.g. validation error) leaves the quotation `sent`.
- Two devices converting at the same moment → exactly one booking, the other
  gets **409**; the unique `booking_id` index is a second guard.
- A retried offline sync (same `idempotency_key`) returns the existing booking
  without touching the quotation.
- Expiry is **not** re-checked at sync time (the operator converted it while
  valid; an offline booking may sync later). Cancelled / accepted are refused.
- If the booking is later deleted, `booking_id` becomes NULL (FK SET NULL); the
  quotation stays `accepted` (history).
- A receipt conversion gets `receipt_created_at` stamped by the existing
  "created as paid" logic in `createBooking`.

`validators/bookingValidator.js` accepts an optional positive-integer
`quotation_id`.

## 7. PDF

`utils/quotationPdfGenerator.js` — `generateQuotationPdf(data)` (shared
`utils/puppeteerBrowser.js`, never its own browser) and `buildQuotationHtml`
(used by tests). Layout:

- header: company logo (or initials) / name / address / phone / email ·
  **QUOTATION** with "SEBUT HARGA" under it · Explore Sabah logo;
- Quotation Details (No., Date, Valid Until with "(n hari/days)", Prepared By)
  and To (name, phone, email, pax — mixed pax spelled out);
- items: #, item & description (type, + supplier company when not ours),
  **Tarikh / Masa Itinerari · Itinerary Date / Time** (activity date + 12-h
  time, no time when midnight; stays with nights), amount;
- **JUMLAH / TOTAL** (no sub total — it was always identical);
- notes & terms (one line per line, blanks skipped); footer "INI BUKAN RESIT /
  THIS IS NOT A RECEIPT".

All text is HTML-escaped. Cancelled quotations get no PDF (400).

## 8. Files

| File | Role |
|---|---|
| `models/quotationModel.js`, `models/quotationItemModel.js` | models |
| `models/associations.js`, `models/index.js`, `models/companyModel.js` | associations, export, `quotation_terms` |
| `routes/quotationRoutes.js`, `server.js` | routes, mounted at `/api/quotations` |
| `controllers/quotationController.js` | thin controller |
| `services/quotationService.js` | rules, queries, draft, conversion lock, terms |
| `policies/quotationPolicy.js`, `policies/index.js` | policy, `POLICY_MAP.quotation` |
| `serializers/quotationSerializer.js` | API shape, effective status, `days_left`, `can_*` flags |
| `utils/quotationHelpers.js` | `QT_` number, MYT today / day start, expiry |
| `utils/quotationPdfGenerator.js` | PDF |
| `services/bookingsService.js`, `validators/bookingValidator.js` | `quotation_id` link in `createBooking` |
| `utils/helpers.js` | `paginatedResponse` takes optional extra top-level fields (used for `counts`) |

## 9. Tests

- **Unit** (`npm run test:unit` / `npx jest tests/unit`):
  `tests/unit/utils/quotationHelpers.test.js`,
  `tests/unit/services/quotationService.test.js` (draft mapping, input rules
  incl. the QA bug fixes), `tests/unit/routes/quotationRoutes.test.js`
  (permissions, company scoping, flags, PDF, terms). Whole suite: **256 pass**.
- **Functional QA** against a local server + MySQL (2026-10-30), run from
  scripts outside the repo: API **103/103**, API flow **52/52**, browser
  **47/47 + 47/47**. Covered: permissions per role, every validation, own
  product / association rules, edit rollback, expiry boundary, conversion
  mapping, rollback on failed booking, simultaneous conversion, cancel, PDF
  content and escaping, company terms, deleted-booking link.

## 10. Deploy

1. Backend first: `npx sequelize-cli db:migrate` runs both migrations.
2. Operators **log in again** (new permissions).
3. Frontend / Android build (see the frontend doc).

## 11. Known limitations / follow-ups

- **Pre-existing:** `POST /api/bookings` answers **200 "Booking already exists
  (idempotent)"** for a *new* booking whenever an `idempotency_key` is sent
  (the controller compares the key with itself). Harmless, but misleading.
- Optional, not built: "Quotation Ref.: QT_0007" on the booking confirmation
  PDF and receipts.
- Possible later: show open quotations' dates as *tentative* on the booking
  calendar, if operators ask (deliberately no separate quotation calendar).
- The same quotation can list one product twice (the app's form prevents it;
  the API allows it).
