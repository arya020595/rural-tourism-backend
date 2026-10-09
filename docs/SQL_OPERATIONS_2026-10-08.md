# Manual SQL Operations — 2026-10-08

Queries prepared and used from DBeaver on the `rural_tourism` database for
one-off data requests (reporting, deleting test bookings, merging a duplicate
company). Kept here so the steps can be reused or audited. **Run in this
order, check the numbers at each step, and take a backup before any
`DELETE`/`UPDATE`.**

---

## 0. Read this first

### Running scripts in DBeaver
Ctrl+Enter sends the whole selection to MySQL as **one statement**. A block
with several statements (e.g. `START TRANSACTION; DELETE ...; COMMIT;`) then
fails with `SQL Error [1064] ... syntax ... near 'DELETE FROM ...'`. Nothing
runs when this happens.

Run multi-statement blocks as a script: select all, then **Alt+X** (SQL Editor →
Execute SQL Script). Alternative: switch the toolbar from **Auto** to
**Manual** commit, run the statements without `START TRANSACTION`/`COMMIT`,
check the results, then press **Commit** or **Rollback**.

### Times are stored in UTC
Malaysia is UTC+8, so Malaysia midnight is 16:00 UTC the day before.

| Malaysia time | Use in `created_at` filters |
|---|---|
| 1 Oct 00:00 | `'2026-09-30 16:00:00'` |
| 2 Oct 00:00 | `'2026-10-01 16:00:00'` |

Using `'2026-10-01'` directly would miss bookings made between Malaysia
midnight and 08:00. To display a stored time in Malaysia time:
`DATE_ADD(created_at, INTERVAL 8 HOUR)`.

### How KTA is linked
`companies` has **no** association column. The association is on
`users.association_id` (KTA = `7`). "KTA companies" therefore means:
```sql
SELECT DISTINCT company_id FROM users
WHERE association_id = 7 AND company_id IS NOT NULL
```

Association IDs: 1 KOBETA, 2 RATA, 3 KOMTDA, 4 USTA, 5 NTA, 6 KATA, 7 KTA.

### Check the connection before running anything destructive
DBeaver has several connections (`rural_tourism` :3307, `rural_tourism 2` :3306,
`rural_tourism_staging` :3308). Confirm which one the editor is using.

---

## 1. Total bookings for one company since 1 October

Counts bookings **created** from 1 Oct 00:00 Malaysia time until now. Replace
`59` with the company ID.

```sql
SELECT
  COUNT(*)                              AS total_bookings,
  SUM(status = 'paid')                  AS paid,
  SUM(status = 'cancelled')             AS cancelled,
  SUM(CASE WHEN status = 'paid' THEN total_price ELSE 0 END) AS paid_revenue_rm
FROM bookings
WHERE company_id = 59
  AND created_at >= '2026-09-30 16:00:00';
```

With a fixed end date (up to and including 8 Oct), add:
```sql
  AND created_at < '2026-10-08 16:00:00'
```
(end date + 1 day, at `16:00:00` of the day before).

Per booking type:
```sql
SELECT booking_type, COUNT(*) AS total, SUM(status = 'paid') AS paid
FROM bookings
WHERE company_id = 59 AND created_at >= '2026-09-30 16:00:00'
GROUP BY booking_type;
```

Note: this counts by **creation date**, not by activity/stay date.

---

## 2. List all KTA bookings created on 1 October

Read-only. Add `AND b.company_id NOT IN (...)` to leave out companies.

```sql
SELECT
  b.id, c.company_name, b.booking_type, b.tourist_full_name,
  b.product_name, b.total_price, b.status,
  DATE_ADD(b.created_at, INTERVAL 8 HOUR) AS created_at_malaysia
FROM bookings b
JOIN companies c ON c.id = b.company_id
WHERE b.company_id IN (
        SELECT DISTINCT company_id FROM users
        WHERE association_id = 7 AND company_id IS NOT NULL
      )
  AND b.created_at >= '2026-09-30 16:00:00'
  AND b.created_at <  '2026-10-01 16:00:00'
ORDER BY c.company_name, b.id;
```

The IDs from this list were reviewed manually, and the bookings to delete were
picked from it.

---

## 3. Delete specific bookings by ID

Bookings: `2635, 2638, 2645, 2649, 2651, 2652, 2637, 2643` (8 bookings).

**3.1 Check the rows exist** (must return 8):
```sql
SELECT COUNT(*) FROM bookings
WHERE id IN (2635, 2638, 2645, 2649, 2651, 2652, 2637, 2643);
```

**3.2 Back up** (run as a script, Alt+X):
```sql
CREATE TABLE bookings_backup_20261008 AS
SELECT * FROM bookings
WHERE id IN (2635, 2638, 2645, 2649, 2651, 2652, 2637, 2643);

CREATE TABLE booking_package_companies_backup_20261008 AS
SELECT * FROM booking_package_companies
WHERE booking_package_id IN (2635, 2638, 2645, 2649, 2651, 2652, 2637, 2643);
```

**3.3 Delete** (run as a script, Alt+X; `ROW_COUNT()` must be 8):
```sql
START TRANSACTION;

DELETE FROM bookings
WHERE id IN (2635, 2638, 2645, 2649, 2651, 2652, 2637, 2643);
-- booking_package_companies rows go too (FK ON DELETE CASCADE)

SELECT ROW_COUNT();

COMMIT;      -- or ROLLBACK;
```

**3.4 Optional: remove the reminder notifications for those bookings.**
Otherwise operators can still tap "booking in 3 days" and open a booking that
no longer exists.
```sql
DELETE FROM notifications
WHERE type = 'booking_reminder'
  AND related_id IN (2635, 2638, 2645, 2649, 2651, 2652, 2637, 2643);
```

**3.5 Restore if needed:**
```sql
INSERT INTO bookings SELECT * FROM bookings_backup_20261008;
INSERT INTO booking_package_companies SELECT * FROM booking_package_companies_backup_20261008;
```

Side effects to know about:
- Bookings already saved on operators' phones for offline use are not removed
  by a server delete; they can keep showing offline until the app data is
  cleared.
- Deletion is permanent. For hiding bookings from reports,
  `UPDATE bookings SET status = 'cancelled'` is reversible.

---

## 4. Merge company 110 into company 128

| ID | Company | Before |
|---|---|---|
| 110 | Pusat Reakriasi Bambangan | 1 user, 30 products, 42 bookings (36 paid) |
| 128 | Pusat Rekreasi Bambangan Lama | 1 user, 13 products, 5 bookings (5 paid) |

### Tables that point to a company
| Table | Column(s) | FK rule on company delete |
|---|---|---|
| `products` | `company_id` | CASCADE |
| `bookings` | `company_id` (+ `company_name` text) | SET NULL |
| `booking_package_companies` | `referrer_id`, `referee_id` (+ name text) | RESTRICT |
| `users` | `company_id` | SET NULL |
| `legacy_id_map` | `new_id` where `entity = 'company'` | — |

`products` has **no** unique constraint on (company, name), so the move itself
cannot fail, but duplicates would show up in the booking dropdowns.

**4.1 Check for duplicate products** (no rows = nothing to merge by hand):
```sql
SELECT p110.id AS id_in_110, p128.id AS id_in_128, p110.name, p110.product_type
FROM products p110
JOIN products p128
  ON p128.company_id = 128
 AND LOWER(TRIM(p128.name)) = LOWER(TRIM(p110.name))
 AND p128.product_type = p110.product_type
WHERE p110.company_id = 110;
```

**4.2 Back up** (Alt+X):
```sql
CREATE TABLE bk_products_20261008  AS SELECT * FROM products WHERE company_id = 110;
CREATE TABLE bk_bookings_20261008  AS SELECT * FROM bookings WHERE company_id = 110;
CREATE TABLE bk_users_20261008     AS SELECT * FROM users    WHERE company_id = 110;
CREATE TABLE bk_pkg_legs_20261008  AS SELECT * FROM booking_package_companies
                                      WHERE referrer_id = 110 OR referee_id = 110;
```

**4.3 Move everything to 128** (Alt+X):
```sql
START TRANSACTION;

UPDATE products SET company_id = 128 WHERE company_id = 110;

UPDATE bookings
SET company_id = 128,
    company_name = (SELECT company_name FROM companies WHERE id = 128)
WHERE company_id = 110;

UPDATE booking_package_companies
SET referrer_id = 128,
    referral_company = (SELECT company_name FROM companies WHERE id = 128)
WHERE referrer_id = 110;

UPDATE booking_package_companies
SET referee_id = 128,
    referee_company = (SELECT company_name FROM companies WHERE id = 128)
WHERE referee_id = 110;

UPDATE users SET company_id = 128 WHERE company_id = 110;

UPDATE legacy_id_map SET new_id = 128 WHERE entity = 'company' AND new_id = 110;

-- All four must be 0:
SELECT
  (SELECT COUNT(*) FROM products  WHERE company_id = 110) AS products_left,
  (SELECT COUNT(*) FROM bookings  WHERE company_id = 110) AS bookings_left,
  (SELECT COUNT(*) FROM users     WHERE company_id = 110) AS users_left,
  (SELECT COUNT(*) FROM booking_package_companies
     WHERE referrer_id = 110 OR referee_id = 110) AS legs_left;

COMMIT;       -- only if all four are 0, otherwise ROLLBACK;
```

**4.4 Check company 128:**
```sql
SELECT c.id, c.company_name,
  (SELECT COUNT(*) FROM users    WHERE company_id = c.id) AS users,
  (SELECT COUNT(*) FROM products WHERE company_id = c.id) AS products,
  (SELECT COUNT(*) FROM bookings WHERE company_id = c.id) AS bookings
FROM companies c WHERE c.id = 128;
```

Result seen after the merge: **43 products, 47 bookings** (as expected: 30+13,
42+5) and **3 users**. Only 2 were expected (1+1), so the third user needs
explaining. Most likely someone added a user to company 128 after the first
count; check with:
```sql
SELECT id, username, email, role_id, company_id, created_at
FROM users WHERE company_id = 128 ORDER BY id;
SELECT id, username, email FROM bk_users_20261008;
```

### Things to know about this merge
- **Do not delete company 110 straight away.** Deleting a company cascades to
  its products. Leave it empty for a few days, then delete only after
  confirming everything works.
- **The moved user joins 128**, so it has two operator admins. The "company
  owner" is the first `operator_admin` by user ID
  (`companyService.getCompanyOwner`), so this may change who can edit the owner
  name/email on the company profile.
- **The moved user must log out and back in.** The app keeps the old company ID
  until they do. Phones with cached products/bookings can show old data until
  it refreshes.
- Bookings keep their original `user_id` (the operator who made them).

### Restore (if needed)
Restoring is manual: copy `company_id` back from the `bk_*` tables, e.g.
```sql
UPDATE products p JOIN bk_products_20261008 b ON b.id = p.id SET p.company_id = b.company_id;
UPDATE bookings k JOIN bk_bookings_20261008 b ON b.id = k.id
  SET k.company_id = b.company_id, k.company_name = b.company_name;
UPDATE users u JOIN bk_users_20261008 b ON b.id = u.id SET u.company_id = b.company_id;
UPDATE booking_package_companies p JOIN bk_pkg_legs_20261008 b ON b.id = p.id
  SET p.referrer_id = b.referrer_id, p.referral_company = b.referral_company,
      p.referee_id = b.referee_id, p.referee_company = b.referee_company;
```
`legacy_id_map` was **not** backed up in step 4.2, so its rows cannot be
restored automatically (after the merge, rows that pointed to 110 and rows that
already pointed to 128 look the same). If you may need to undo that part, back
it up before step 4.3:
```sql
CREATE TABLE bk_legacy_id_map_20261008 AS
SELECT * FROM legacy_id_map WHERE entity = 'company' AND new_id IN (110, 128);
```
The legacy map is only a record of the KTA data migration; the app does not
read it.

---

## 5. Cleanup (after a few days, once everything is confirmed)
```sql
DROP TABLE IF EXISTS bookings_backup_20261008;
DROP TABLE IF EXISTS booking_package_companies_backup_20261008;
DROP TABLE IF EXISTS bk_products_20261008;
DROP TABLE IF EXISTS bk_bookings_20261008;
DROP TABLE IF EXISTS bk_users_20261008;
DROP TABLE IF EXISTS bk_pkg_legs_20261008;
```
