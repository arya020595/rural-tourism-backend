# Shared Companies — Legacy `rt_user` → `companies`

**Source:** `dump-rural_tourism-202609041538.sql` (old system)  
**Generated:** 2026-09-04

In the old system there is no `companies` table — the business name lives as a string on
`rt_user.full_name`. Several users share the same business name. On migration each distinct
business becomes **one** `companies` row, and all its users point at it via `users.company_id`.

> Creating one company per *user* instead would produce 16 duplicate "Murug Turug Eco Tourism"
> companies. See `LEGACY_DB_MIGRATION_ANALYSIS.md` §3.

## Summary

| Metric | Value |
|---|---:|
| Legacy users (`rt_user`) | 64 |
| Distinct businesses | **44** |
| Businesses shared by >1 user | **6** |
| Users belonging to a shared business | **26** |
| Businesses with exactly 1 user | 38 |

## Shared businesses

| # | Business (→ one `companies` row) | Users | Products | Receipts | Revenue (RM) |
|---|---|---:|---:|---:|---:|
| 1 | **Murug Turug Eco Tourism** | 16 | 83 | 395 | 133,155.00 |
| 2 | **Kiulu Tourism and Vacation Centre** | 2 | 9 | 51 | 7,538.00 |
| 3 | **Revelation Resources** | 2 | 5 | 1 | 90.00 |
| 4 | **Sobo Hiking** | 2 | 2 | 0 | 0.00 |
| 5 | **MonggiLand Waterfall** | 2 | 6 | 6 | 1,575.00 |
| 6 | **Dapako Hill - Lingga Eco Tourism** | 2 | 31 | 205 | 373,190.50 |

---

### 1. Murug Turug Eco Tourism

| user_id | username (→ `users.name`/`username`) | email | Acts | Accs | Receipts | Revenue (RM) |
|---|---|---|---:|---:|---:|---:|
| `U03714247` | ANGELIN SIKON | `angelinsikon@gmail.com` | 5 | 0 | 3 | 255.00 |
| `U08636325` | Anisia dora jonius | `anisiadorajonius@gmail.com` | 5 | 0 | 2 | 100.00 |
| `U08326296` | Arianjiloh | `arianjilo9@gmail.com` | 8 | 0 | 18 | 7,601.00 |
| `U05630893` | Bibiana Dianus | `bunnykookie9701@gmail.com` | 5 | 0 | 212 | 106,222.00 |
| `U08795414` | Collin | `collinssolungki@gmail.com` | 5 | 0 | 0 | 0.00 |
| `U02470096` | FAZZIRA JUPRI | `mykiejaah@gmail.com` | 6 | 0 | 4 | 385.00 |
| `U01742489` | Leistah Gummil | `Leistahg@gmail.com` | 5 | 0 | 25 | 2,463.00 |
| `U08698816` | Liza allane Guansing | `lizaallane6@gmail.com` | 5 | 0 | 4 | 95.00 |
| `U09736623` | Lusay Binti Daimi | `lucysua63@gmail.com` | 9 | 0 | 8 | 1,025.00 |
| `U07206686` | Newmond Guansing | `Kungkumguansing@gmail.com` | 5 | 0 | 64 | 677.00 |
| `U09379905` | Rollins | `sylvesterrolyn961@gmail.com` | 5 | 0 | 5 | 365.00 |
| `U05502752` | Rusnih Ginsingan | `rusnihg1983@icloud.com` | 3 | 0 | 6 | 225.00 |
| `U05851917` | sanziorygbiee | `sanzgb08@gmail.com` | 5 | 0 | 5 | 647.00 |
| `U08367860` | SUZILAWATI | `Awierah1234@gmail.com` | 6 | 0 | 13 | 2,480.00 |
| `U08207272` | Suzilawati Amy | `suzilawatiamy6@gmail.com` | 1 | 0 | 0 | 0.00 |
| `U03293416` | Zainab Suadah | `inawillnna@gmail.com` | 5 | 0 | 26 | 10,615.00 |

**Product dedup needed — 44 duplicate row(s)** once these users merge into one company:

| Product name | Type | Copies |
|---|---|---:|
| hiking | activity | 15 |
| PAKEJ A (HIKING) | activity | 5 |
| PAKEJ B | activity | 4 |
| pakej C (haiking) | activity | 3 |
| pakej A(Haiking) | activity | 3 |
| Pakej B (Hiking) | activity | 3 |
| Pakej C (Hiking) | activity | 3 |
| PAKEJ A | activity | 3 |
| PAKEJ C | activity | 3 |
| Pakej Ultra (Hiking) | activity | 3 |
| ultra | activity | 3 |
| PAKEJ B ( HIKING ) | activity | 2 |
| PAKEJ C ( HIKING ) | activity | 2 |
| PAKEJ ULTRA | activity | 2 |
| HIKKING | activity | 2 |
| PAKEJ ULTRA ( HIKKING ) | activity | 2 |
| Pakej C(hiking) | activity | 2 |
| Pakej B(hiking) | activity | 2 |

---

### 2. Kiulu Tourism and Vacation Centre

| user_id | username (→ `users.name`/`username`) | email | Acts | Accs | Receipts | Revenue (RM) |
|---|---|---|---:|---:|---:|---:|
| `U03471116` | Justin Umis | `ktvc@gmail.com` | 5 | 1 | 43 | 5,498.00 |
| `U00555452` | Shaheera | `shaheera@stadvisory.com` | 1 | 2 | 8 | 2,040.00 |

No duplicate product names — nothing to dedup.

---

### 3. Revelation Resources

| user_id | username (→ `users.name`/`username`) | email | Acts | Accs | Receipts | Revenue (RM) |
|---|---|---|---:|---:|---:|---:|
| `U08056368` | joslenny84 | `joslennyjoseph84@gmail.com` | 1 | 0 | 0 | 0.00 |
| `U01863056` | Victor83 | `gunsarok83@gmail.com` | 3 | 1 | 1 | 90.00 |

**Product dedup needed — 2 duplicate row(s)** once these users merge into one company:

| Product name | Type | Copies |
|---|---|---:|
| HIKING | activity | 2 |
| CANYONING | activity | 2 |

---

### 4. Sobo Hiking

| user_id | username (→ `users.name`/`username`) | email | Acts | Accs | Receipts | Revenue (RM) |
|---|---|---|---:|---:|---:|---:|
| `U02275515` | SOBO | `sevry72@gmail.com` | 1 | 0 | 0 | 0.00 |
| `U03277513` | sobo hiking | `sevry@gmail.com` | 1 | 0 | 0 | 0.00 |

**Product dedup needed — 1 duplicate row(s)** once these users merge into one company:

| Product name | Type | Copies |
|---|---|---:|
| hiking | activity | 2 |

---

### 5. MonggiLand Waterfall

| user_id | username (→ `users.name`/`username`) | email | Acts | Accs | Receipts | Revenue (RM) |
|---|---|---|---:|---:|---:|---:|
| `U07731392` | MLET | `monggiland2025@gmail.com.my` | 4 | 0 | 6 | 1,575.00 |
| `U03025470` | Rubby james@ enjim | `monggiland2025@gmail.com` | 2 | 0 | 0 | 0.00 |

**Product dedup needed — 1 duplicate row(s)** once these users merge into one company:

| Product name | Type | Copies |
|---|---|---:|
| hiking | activity | 2 |

---

### 6. Dapako Hill - Lingga Eco Tourism

| user_id | username (→ `users.name`/`username`) | email | Acts | Accs | Receipts | Revenue (RM) |
|---|---|---|---:|---:|---:|---:|
| `U09900016` | Kait Lansangan | `Lanskait.Lanskait@gmail.com` | 27 | 2 | 204 | 373,090.50 |
| `U05858500` | Marius bin garilo | `mariusbingarilo@mail.com` | 2 | 0 | 1 | 100.00 |

**Product dedup needed — 10 duplicate row(s)** once these users merge into one company:

| Product name | Type | Copies |
|---|---|---:|
| Wet Kitchen | activity | 6 |
| Kayak | activity | 3 |
| Hiking | activity | 2 |
| Team Building | activity | 2 |
| Walai Dapako | accommodation | 2 |

---

## Migration notes

### Matching rule

Group on a **normalised** business name — collapse internal whitespace, trim, compare
case-insensitively:

```sql
LOWER(TRIM(REGEXP_REPLACE(full_name, '\s+', ' ')))
```

Without normalisation, `'Revelation Resources '` and `'Revelation Resources'` become two companies.

### Resulting structure

```
companies (44 rows)
   └── users.company_id  ──  64 users (26 of them in the 6 shared businesses)
         └── products.company_id  ──  deduped catalogue, shared by all the company's users
```

`products` has **no** `user_id` column — a product belongs to the company, so every user of that
company sees the same catalogue. This is why dedup matters: without it, "Murug Turug Eco Tourism"
would carry 44 duplicate activity rows.

### Verified against production

Legacy business names were checked against the 105 companies already in the production database:
**0 collisions.** Every one of these 44 companies is new. See
`LEGACY_DB_MIGRATION_ANALYSIS.md` §8.
