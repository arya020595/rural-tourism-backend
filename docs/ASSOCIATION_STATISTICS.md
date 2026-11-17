# Association Statistics (own association) — Backend

As-built reference for the association users' statistics page (branch
`features/newfeatures29oct`, 2026-11-01). Frontend side:
`docs/ASSOCIATION_STATISTICS_FRONTEND.md` in the frontend repo.

This is **separate from the Power BI dashboard** (`/association/dashboard`),
which is unchanged and will show the association's Power BI link once one is
set.

---

## 1. What it does

An association user sees the same figures the superadmin's
`/admin/association-stats` page shows, but **only for their own association**,
plus a list of its member companies. Each member has an "i" profile pop-up
(read-only, with documents).

## 2. Figures

`dashboardService.getAssociationStats(from, to, { associationId })` is the
superadmin query with an optional association filter. Omitting the filter
gives the superadmin page exactly as before.

| Figure | Rule |
|---|---|
| totalBookings | all bookings, any status |
| totalPending / totalReceipts (paid) / totalCancelled | split of totalBookings |
| totalTourists ("Count of Activities Attended by Visitors") | pax (local + international) of **paid** bookings |
| totalDeposit | deposits of pending + cancelled bookings (paid bookings' deposits are inside totalRevenue) |
| totalDepositPending / totalDepositCancelled | the two parts of totalDeposit (added 2026-11-02; also returned per association on the superadmin endpoint). The pages no longer show the deposit figures, because both statistics pages now use the same design without a deposit section; the API still returns them, so a card can come back without backend changes. |
| totalRevenue | `total_price` of paid bookings |
| full-time / part-time workers | sum over **approved** companies |
| registered companies | number of **approved** member companies |

- A company's association is its users' `users.association_id`, collapsed to
  one association per company so nothing is counted twice.
- Date range: optional `from` + `to` (`YYYY-MM-DD`, both or neither, validated
  by `dashboardValidator.validateAssociationStatsQuery`). It filters bookings
  on `COALESCE(receipt_created_at, updated_at, created_at)`, the same as the
  superadmin page.

**Members** (`getAssociationMembers`) are the association's **approved**
companies with:

- owner name (the operator_admin, else the first user)
- location, contact and email
- full-time / part-time staff
- joined date (`registration_reviewed_at`, else `created_at`)
- `totalTourists` for the same date range

The sum of the members' `totalTourists` equals the page's total (checked for
all-time and for October 2026). Revenue and booking counts per member were
removed from the response on request.

## 3. API — `/api/dashboard`

| Method & path | Auth | Returns |
|---|---|---|
| `GET /my-association-stats?from&to` | `authorize("association:read")` | `{ association: {id,name}, totals, members[] }`. 403 "Your account is not linked to an association." if the token has no `association_id` (e.g. superadmin) |
| `GET /my-association-members/:companyId` | `authorize("association:read")` + `associationMember` policy | member profile via `serializers/associationMemberSerializer.js`: company fields, `joined_at`, `association`, `owner {name, username, email}`, `documents`. 403 for another association's company or a company that isn't approved; 400 for a non-numeric id |

- `association:read` is given to the association role by migration
  `20261104000000-grant-association-read-to-association-role.js`. It was assumed
  to be there already (true on local databases), but seeder
  `20260423000003-update-association-role-permissions.js` had cut the role down to
  `bi_dashboard:read` on staging/production, so the menu item was hidden there.
  It can also be ticked by hand in *Role Management* (that is how staging was
  fixed); the migration then does nothing. Association users must **log out and in
  again** afterwards to see the page (the menu reads the permissions from the login
  response).
- The association is always taken from the token, never from the request, so
  a user can't ask for another association's figures.

## 4. Files

| File | Role |
|---|---|
| `services/dashboardService.js` | `getAssociationStats(..., { associationId })`, `getMyAssociationStats`, `getAssociationMembers`, `getAssociationMember` |
| `controllers/dashboardController.js`, `routes/dashboardRoutes.js` | the two routes |
| `policies/associationMemberPolicy.js`, `policies/index.js` | same association + approved, or admin; `POLICY_MAP.associationMember` |
| `serializers/associationMemberSerializer.js` | profile shape (owner id left out) |

## 5. Tests

- **Unit:** `tests/unit/routes/associationStatisticsRoutes.test.js` (7). Covers
  the permission check, own-association scoping, half date range → 400,
  serializer shape, another association → 403, pending → 403, and superadmin
  access.
- **Functional, local:**
  - kta's totals match the KTA row on the superadmin page (2,251 bookings,
    37 companies).
  - kobeta sees only KOBETA.
  - October 2026 range: 14 bookings.
  - Browser test: 15/15 (2026-11-01).
