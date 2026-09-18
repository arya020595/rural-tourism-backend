# Companies and Users — Legacy Migration Roster

**Source:** `dump-rural_tourism-202609141032.sql` (old system, snapshot 2026-09-14)  
**After exclusions:** 4 test accounts (§8.7) + 3 whole companies confirmed dummy — "Kiulu Tourism
and Vacation Centre" (§8.10), "Revelation Resources" and "Sobo Hiking" (§8.11) — removed

One row per user that will be created under `users`, grouped by the `companies` row it
belongs to. `operator_admin` / `operator_staff` assignment follows the rule decided in §3 of
the main analysis doc: within a shared company, the user with the most receipts becomes
`operator_admin`; a single-user company defaults its one user to `operator_admin`. See that doc
for the reasoning — this file is the flat roster for reference during migration.

## Summary

| Metric | Value |
|---|---:|
| Companies | 37 |
| Users | 54 |
| Shared companies (>1 user) | 3 |
| Single-user companies | 34 |

---

## Shared companies (multiple users)

> **Three companies excluded from this roster** — all confirmed dummy by the team, 2026-09-14:
> - "Kiulu Tourism and Vacation Centre" (Justin Umis `U03471116`, Shaheera `U00555452`) — see
>   `LEGACY_DB_MIGRATION_ANALYSIS.md` §8.10, including the 15 package receipts also dropped.
> - "Revelation Resources" (Victor83 `U01863056`, joslenny84 `U08056368`)
> - "Sobo Hiking" (SOBO `U02275515`, sobo hiking `U03277513`)
>
> See §8.11 for the latter two.

### Murug Turug Eco Tourism

> Admin reassigned 2026-09-14 (team-confirmed ground truth overrides receipt-volume heuristic —
> see main analysis doc §3).

| Role | Username | Email | user_id | Receipts |
|---|---|---|---|---:|
| **operator_admin** | Collin | `collinssolungki@gmail.com` | `U08795414` | 0 |
| operator_staff | Bibiana Dianus | `bunnykookie9701@gmail.com` | `U05630893` | 217 |
| operator_staff | Newmond Guansing | `Kungkumguansing@gmail.com` | `U07206686` | 64 |
| operator_staff | Zainab Suadah | `inawillnna@gmail.com` | `U03293416` | 26 |
| operator_staff | Leistah Gummil | `Leistahg@gmail.com` | `U01742489` | 25 |
| operator_staff | Arianjiloh | `arianjilo9@gmail.com` | `U08326296` | 18 |
| operator_staff | SUZILAWATI | `Awierah1234@gmail.com` | `U08367860` | 13 |
| operator_staff | Lusay Binti Daimi | `lucysua63@gmail.com` | `U09736623` | 8 |
| operator_staff | Rusnih Ginsingan | `rusnihg1983@icloud.com` | `U05502752` | 6 |
| operator_staff | sanziorygbiee | `sanzgb08@gmail.com` | `U05851917` | 5 |
| operator_staff | Rollins | `sylvesterrolyn961@gmail.com` | `U09379905` | 5 |
| operator_staff | FAZZIRA JUPRI | `mykiejaah@gmail.com` | `U02470096` | 4 |
| operator_staff | Liza allane Guansing | `lizaallane6@gmail.com` | `U08698816` | 4 |
| operator_staff | ANGELIN SIKON | `angelinsikon@gmail.com` | `U03714247` | 3 |
| operator_staff | Anisia dora jonius | `anisiadorajonius@gmail.com` | `U08636325` | 2 |
| operator_staff | Suzilawati Amy | `suzilawatiamy6@gmail.com` | `U08207272` | 0 |

### MonggiLand Waterfall

> Admin reassigned 2026-09-14 (team-confirmed ground truth overrides receipt-volume heuristic —
> see main analysis doc §3).

| Role | Username | Email | user_id | Receipts |
|---|---|---|---|---:|
| **operator_admin** | Rubby james@ enjim | `monggiland2025@gmail.com` | `U03025470` | 0 |
| operator_staff | MLET | `monggiland2025@gmail.com.my` | `U07731392` | 6 |

> Note: the two emails differ only by a trailing `.my` — likely a typo on one account, not two
> genuinely different addresses. Not corrected here; flagged for awareness during migration.

### Dapako Hill - Lingga Eco Tourism

| Role | Username | Email | user_id | Receipts |
|---|---|---|---|---:|
| **operator_admin** | Kait Lansangan | `Lanskait.Lanskait@gmail.com` | `U09900016` | 225 |
| operator_staff | Marius bin garilo | `mariusbingarilo@mail.com` | `U05858500` | 1 |

---

## Single-user companies

One row = one company = one user (automatically `operator_admin` — nobody else to be staff).

| Company | Username | Email | user_id |
|---|---|---|---|
| AmiirulHamizan_Panda | Meezan_2108 | `meezan2108@gmail.com` | `U09809220` |
| Botung Campsite | Laudin@Jerry bin Ransoi | `jer2393@gmail.com` | `U00777072` |
| Disan Baang Kiulu | Soimon Sinit | `sinitsoimon9@gmail.com` | `U09982246` |
| Eko Pelancongan Watu Kokoluton Hill Talantang Kiulu | francisca dauni | `watukokoluton@gmail.com` | `U06417696` |
| Ellamat Cottage | muin_elamat | `ellamat.cottage@gmail.com` | `U01641351` |
| G'Datau Garden | Rayner Ray | `nerviperray963@gmail.com` | `U03579461` |
| Go Go Rafting | kenedy runsab | `kenkenedy290@gmail` | `U03986544` |
| Hawunvalley | Toisin | `toisinlamat.60@gmail.com` | `U08600156` |
| Jurassic Land Kiulu | Geoffrey Damianus | `Jurassiclandkiulu@gmail.com` | `U01481674` |
| KLK Lodge Ponohuon Kiulu | Tauin Lontou | `tauinlontou@gmail.com` | `U00052077` |
| KONDIS POINT Kiulu | lasendrio | `lasendrio2004@gmail.com` | `U05526543` |
| Kiharo Garden | EILEEN GUSIN | `gejy30@gmail.com` | `U00530252` |
| Kiharo Pantalaban Hill | Kiharo Pantalaban | `kiharopantalabanresit@gmail.com` | `U08435657` |
| Kiulu Eco-Tourism | Justin Ranny | `justinranny@gmail.com` | `U05169282` |
| Kiulu Farmstay | Sabrina | `sabrinabryanna1177@gmail.com` | `U04653348` |
| Koperasi Pelancongan Kampung Tiong Simpodon Berhad | Jinik | `jinikonpassave@gmail.com` | `U07101920` |
| Laudin Jerry bin Ransoi | jerry | `laujer93@yahoo.com` | `U09115385` |
| Lubok Riverside Campsite | Amandus Juanis | `amanduslaw80@gmail.com` | `U06191477` |
| Minurod Campsite | MINUROD CAMPSITE | `Juansonmoidin@gmail.com` | `U07371871` |
| Monggoluton River View & Picnic Centre | ilinyubi | `ailinyubi@gmail.com` | `U06574678` |
| Outreach Borneo | June Baidin | `outreachborneo@gmail.com` \* | `U04868139` |
| PK Heritage Lodge kiulu | Chupia Guting | `Pkheritage.kiulu@gmail.com` | `U06209004` |
| Pusat Reakriasi Bambangan | PRBL-KM19 | `linaselina564@gmail.com` | `U00636916` |
| Pusat Rekreasi Bambangan Lama | PRBL_KM19 | `lorettagimi80@gmail.com` | `U06165671` |
| RS Kamandus View | Abnor Duah | `rskamandusview@gmail.com` | `U01275101` |
| Ratau Campsite Eko-Pelancongan Komuniti Kg. Ratau Kiulu | Citinnaly | `rataucampsite@gmail.com` | `U09797718` |
| Shasha \*\* | Shaheera123 | `nurulshaheera02@gmail.com` | `U05173361` |
| Sinopian RC | Dodibitius Bangin | `expertfx7@gmail.com` | `U00544223` |
| Steph Travel Tour Sabah Kiulu | Tonny Sikul | `tonnysikul1972@gmail.com` | `U09136741` |
| Tibabar Riverside Ecotourism | Rosland | `beatneysuan8@gmail.com` | `U05500624` |
| Tongkoluson Campsite | Sipin kunding | `Mysipin64@gmaill.com` | `U02932675` |
| Tukad Sandangau Gonipis Lama Kiulu | david bin gungkit | `davidgungkit@46com.my` | `U00180876` |
| kiharo | kiharo2019 | `gloryandrew918@gmail.com` | `U04936623` |
| ru dive | dive ru | `dive@dive.com` | `U09860679` |

\* **Outreach Borneo's email was a collision as of the original snapshot** — it also belonged to
production user id=76 (Mejin Bin Maginggow, Taburan Beach Camp / KOBETA). Resolved: Taburan Beach
Camp moved to `enjoyborneoadventure@gmail.com` (confirmed live in production, 2026-09-14), freeing
this address for the legacy account above. See `LEGACY_DB_MIGRATION_ANALYSIS.md` §8.1/§8.3 for the
full story — this is not an unresolved conflict.

\*\* This account (`U05173361`, 0 receipts) is unrelated to "Kiulu Tourism and Vacation Centre"
above — an earlier note in the main analysis doc speculated a connection to another Shaheera
account, which has since been confirmed dummy and excluded. See
`LEGACY_DB_MIGRATION_ANALYSIS.md` §8.7 for the correction.