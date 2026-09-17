#!/usr/bin/env node
/**
 * Parses the legacy Kiulu system's SQL dump (rt_user, activity,
 * accomodation, form_responses) and applies every migration decision from
 * docs/LEGACY_DB_MIGRATION_ANALYSIS.md, producing a static seed-data module
 * for the migration seeders under seeders/.
 *
 * Usage:
 *   node scripts/parseLegacyDump.js [path/to/dump.sql] > seeders/data/legacy-kiulu-seed-data.js
 *
 * Run once, review the printed summary on stderr, inspect the generated
 * file, then commit it — this script itself is not part of the seeder
 * chain (see docs/LEGACY_DB_MIGRATION_ANALYSIS.md, "Files to create").
 */

const fs = require("fs");
const path = require("path");

const DEFAULT_DUMP_PATH = "dump-rural_tourism-202609141032.sql";

// --- Decisions from docs/LEGACY_DB_MIGRATION_ANALYSIS.md -------------------

// §8.7 — confirmed test accounts, zero live revenue, excluded outright.
const EXCLUDED_TEST_ACCOUNTS = new Set([
  "U05339512", // tester / test@123.com
  "U08812032", // adsdasd / test@123.comss
  "U01241029", // mail.ehsan / mail.ehsan@e.com ("dummybusiness")
  "U08459140", // zana / zana@stadvisory.com
]);

// §8.10, §8.11 — whole companies confirmed dummy by the team; every user
// under them is excluded along with their products and receipts.
const EXCLUDED_DUMMY_COMPANY_USERS = new Set([
  "U00555452", // Shaheera — Kiulu Tourism and Vacation Centre (§8.10)
  "U03471116", // Justin Umis — Kiulu Tourism and Vacation Centre (§8.10)
  "U01863056", // Victor83 — Revelation Resources (§8.11)
  "U08056368", // joslenny84 — Revelation Resources (§8.11)
  "U02275515", // SOBO — Sobo Hiking (§8.11)
  "U03277513", // sobo hiking — Sobo Hiking (§8.11)
]);

// §8.6 — orphaned users (no rt_user row) whose products/receipts are
// dropped outright: one stray "Kayak" product each, no receipts, or (for
// U04128926) one small unattributable receipt not worth chasing further.
const DROPPED_ORPHAN_USER_IDS = new Set([
  "U01262981",
  "U04677217",
  "U09918731",
  "U04128926",
]);

// §8.6 — U01047249 is a confirmed earlier, deleted account for Dapako Hill
// (the "Walai Dapako" accommodation name match). Its products and receipts
// are reattached to the live Dapako Hill account for company resolution.
const ORPHAN_REATTACH_USER_ID = "U01047249";
const ORPHAN_REATTACH_TARGET_USER_ID = "U09900016"; // Kait Lansangan

// §8.8, B3 — the only package leg nameOfBusiness that doesn't resolve to a
// company once names are normalised (trim + collapse whitespace + lower).
const PACKAGE_NAME_ALIASES = {
  "dapako hill": "dapako hill - lingga eco tourism",
};

// W8 — 3 receipts reference a homest_id no longer present in the source
// accomodation table. Traced by hand against each receipt's product-name
// snapshot and the real accommodation catalogue of the SAME company that
// issued the receipt (confirmed same company in both cases):
//   PE2057803 "Sondoton view"  -> acc_01312064 "SONDOTON VIEW RM150.00"
//                                 (Pusat Rekreasi Bambangan Lama)
//   PE2578633 "Agaragas hut"   -> acc_08025445 "Agaragas Hut RM150.00"
//                                 (Pusat Rekreasi Bambangan Lama)
//   PE6593345 lists 7 rooms/halls in one receipt -> acc_04713450, the one
//                                 listing under Pusat Reakriasi Bambangan
//                                 that already combines the same 6 of those
//                                 7 rooms into a single product (missing
//                                 only "ability hall") — the closest match,
//                                 not exact, but the same operator and the
//                                 only combined-venue listing they have.
const ORPHAN_PRODUCT_ID_ALIASES = {
  acc_06469793: "acc_01312064",
  acc_05208093: "acc_08025445",
  acc_09848368: "acc_04713450",
};

// §3 — operator_admin per shared company, confirmed by the team directly
// (NOT derived from receipt volume — see docs/LEGACY_DB_MIGRATION_ANALYSIS.md
// §3 for why the receipt-volume heuristic was wrong for 2 of these 3).
// Every user not listed here defaults to operator_admin if they are the
// sole user of their company, or operator_staff otherwise.
const CONFIRMED_COMPANY_ADMINS = new Set([
  "U08795414", // Collin — Murug Turug Eco Tourism
  "U03025470", // Rubby james@ enjim — MonggiLand Waterfall
  "U09900016", // Kait Lansangan — Dapako Hill - Lingga Eco Tourism
]);

// §3 — Sobo Hiking's admin is undecided, but the whole company is excluded
// under §8.11 anyway, so this never matters in practice.

// --- SQL INSERT VALUES parser (bracket/quote-aware) -------------------------

function parseInsertRows(sql, tableName) {
  const marker = `INSERT INTO \`${tableName}\` VALUES `;
  const startIdx = sql.indexOf(marker);
  if (startIdx === -1) return [];

  // The statement-terminating ";" cannot be found with a plain indexOf: the
  // dump uses CRLF line endings (";\r\n"), so an indexOf(";\n") search never
  // matches and previously ran the parser past the statement into the rest
  // of the file. Instead, track quote/paren depth in a single pass and stop
  // at the first depth-0 ";" — this is also robust against a literal ";"
  // inside a quoted value, which a naive indexOf(";") would break on.
  const rows = [];
  let cur = [];
  let buf = "";
  let inQuotes = false;
  let escaped = false;
  let depth = 0;
  const start = startIdx + marker.length;

  for (let i = start; i < sql.length; i += 1) {
    const c = sql[i];

    if (inQuotes) {
      if (escaped) {
        buf += c;
        escaped = false;
      } else if (c === "\\") {
        escaped = true;
      } else if (c === "'") {
        if (sql[i + 1] === "'") {
          buf += "'";
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        buf += c;
      }
      continue;
    }

    if (c === ";" && depth === 0) {
      break; // end of statement
    }

    if (c === "'") {
      inQuotes = true;
    } else if (c === "(" && depth === 0) {
      depth = 1;
      buf = "";
      cur = [];
    } else if (c === "," && depth === 1) {
      cur.push(buf.trim());
      buf = "";
    } else if (c === ")" && depth === 1) {
      cur.push(buf.trim());
      rows.push(cur);
      depth = 0;
      buf = "";
    } else if (depth === 1) {
      buf += c;
    }
  }

  return rows;
}

function nullOrString(value) {
  return value === "NULL" ? null : value;
}

function normalizeCompanyName(name) {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

// --- Main ---------------------------------------------------------------

function main() {
  const dumpPath = process.argv[2] || DEFAULT_DUMP_PATH;
  const resolvedPath = path.resolve(dumpPath);
  const sql = fs.readFileSync(resolvedPath, "utf8");

  const rtUserRows = parseInsertRows(sql, "rt_user");
  const activityRows = parseInsertRows(sql, "activity");
  const accomRows = parseInsertRows(sql, "accomodation");
  const formResponseRows = parseInsertRows(sql, "form_responses");

  if (!rtUserRows.length) {
    throw new Error(
      `No rt_user rows parsed from ${resolvedPath} — check the dump path/format.`,
    );
  }

  // ---- Users: apply exclusions -----------------------------------------

  const excludedUserIds = new Set([
    ...EXCLUDED_TEST_ACCOUNTS,
    ...EXCLUDED_DUMMY_COMPANY_USERS,
  ]);

  const keptRtUsers = rtUserRows.filter((r) => !excludedUserIds.has(r[0]));

  // Map every kept legacy user_id -> its (possibly reattached) owner id,
  // for resolving which company a product/receipt belongs to.
  const ownerUserIdFor = (userId) =>
    userId === ORPHAN_REATTACH_USER_ID
      ? ORPHAN_REATTACH_TARGET_USER_ID
      : userId;

  const rtUserById = new Map(rtUserRows.map((r) => [r[0], r]));

  // ---- Companies: derive from kept users' full_name, normalised --------

  const companyKeyToName = new Map(); // normalisedKey -> display name (first seen)
  for (const r of keptRtUsers) {
    const fullName = r[4].trim();
    const key = normalizeCompanyName(fullName);
    if (!companyKeyToName.has(key)) companyKeyToName.set(key, fullName);
  }

  const companies = Array.from(companyKeyToName.entries()).map(
    ([legacyKey, company_name]) => ({
      legacyKey,
      company_name,
      location: "Kiulu",
    }),
  );

  // ---- Users: build seed rows with role assignment ----------------------

  // Count company membership size (post-exclusion) to know single- vs
  // multi-user companies for the default admin rule.
  const usersPerCompanyKey = new Map();
  for (const r of keptRtUsers) {
    const key = normalizeCompanyName(r[4].trim());
    usersPerCompanyKey.set(key, (usersPerCompanyKey.get(key) || 0) + 1);
  }

  const users = keptRtUsers.map((r) => {
    const [userId, username, email, password, fullName] = r;
    const companyKey = normalizeCompanyName(fullName.trim());
    const companySize = usersPerCompanyKey.get(companyKey);

    let role;
    if (companySize === 1) {
      role = "operator_admin";
    } else if (CONFIRMED_COMPANY_ADMINS.has(userId)) {
      role = "operator_admin";
    } else {
      role = "operator_staff";
    }

    return {
      legacyUserId: userId,
      name: username.trim(),
      username: username.trim(),
      email,
      password,
      company_legacy_key: companyKey,
      role,
    };
  });

  // ---- Products: activity + accomodation, with orphan handling ---------

  function buildProducts(rows, productType) {
    const out = [];
    for (const r of rows) {
      const [legacyProductId, name, , ownerId] = r;

      if (DROPPED_ORPHAN_USER_IDS.has(ownerId)) continue;

      const resolvedOwnerId = ownerUserIdFor(ownerId);
      const owner = rtUserById.get(resolvedOwnerId);
      if (!owner) continue; // excluded user (test account / dummy company)
      if (excludedUserIds.has(resolvedOwnerId)) continue;

      const companyKey = normalizeCompanyName(owner[4].trim());

      out.push({
        legacyProductId,
        legacyProductType: productType,
        name: nullOrString(name) || "",
        company_legacy_key: companyKey,
      });
    }
    return out;
  }

  const products = [
    ...buildProducts(activityRows, "activity"),
    ...buildProducts(accomRows, "accommodation"),
  ];

  // ---- Bookings: form_responses, split activity/accommodation/package --

  const activityProductIds = new Set(
    activityRows.map((r) => r[0]),
  );
  const accomProductIds = new Set(accomRows.map((r) => r[0]));

  const bookings = [];
  let skippedExcludedReceipts = 0;

  for (const r of formResponseRows) {
    const [
      receiptId,
      userId,
      citizenship,
      pax,
      activityName,
      homestName,
      ,
      activityId,
      homestId,
      totalRm,
      totalNight,
      packageJson,
      issuer,
      status,
      date,
      createdAt,
    ] = r;

    if (DROPPED_ORPHAN_USER_IDS.has(userId)) {
      skippedExcludedReceipts += 1;
      continue;
    }

    const resolvedUserId = ownerUserIdFor(userId);
    if (excludedUserIds.has(resolvedUserId)) {
      skippedExcludedReceipts += 1;
      continue;
    }

    const owner = rtUserById.get(resolvedUserId);
    if (!owner) {
      // Shouldn't happen once orphan/exclusion sets are correct, but skip
      // defensively rather than crash the whole parse.
      skippedExcludedReceipts += 1;
      continue;
    }

    const hasActivity = activityId && activityId !== "NULL" && activityId !== "";
    const hasAccom = homestId && homestId !== "NULL" && homestId !== "";
    const isPackage = packageJson && packageJson !== "NULL";

    let bookingType;
    let legacyProductId = null;
    if (isPackage) {
      bookingType = "package";
    } else if (hasActivity) {
      bookingType = "activity";
      legacyProductId = activityId;
    } else if (hasAccom) {
      bookingType = "accommodation";
      legacyProductId = homestId;
    } else {
      // No product reference and no package payload — shouldn't occur per
      // the analysis (every form_responses row is exactly one of the three
      // shapes), but skip rather than guess.
      skippedExcludedReceipts += 1;
      continue;
    }

    // W8 — resolve the 3 known orphan homest_id references to their real
    // product, hand-traced against the same operator's accommodation
    // catalogue (see ORPHAN_PRODUCT_ID_ALIASES above). Applied before the
    // legacyProductKind lookup below so these bookings link normally
    // instead of falling back to product_id = NULL.
    if (legacyProductId && ORPHAN_PRODUCT_ID_ALIASES[legacyProductId]) {
      legacyProductId = ORPHAN_PRODUCT_ID_ALIASES[legacyProductId];
    }

    let packageLegs = null;
    if (isPackage) {
      let parsed;
      try {
        parsed = JSON.parse(packageJson);
      } catch (err) {
        parsed = [];
      }
      packageLegs = parsed.map((leg) => {
        const rawName = String(leg.nameOfBusiness || "").trim();
        const key = normalizeCompanyName(rawName);
        const aliasedKey = PACKAGE_NAME_ALIASES[key] || key;
        return {
          description: leg.packageDesc || "",
          totalRm: Number(leg.total_rm) || 0,
          company_legacy_key: aliasedKey,
        };
      });
    }

    bookings.push({
      legacyReceiptId: receiptId,
      bookingType,
      legacyUserId: resolvedUserId,
      legacyProductId,
      legacyProductKind:
        legacyProductId && activityProductIds.has(legacyProductId)
          ? "activity"
          : legacyProductId && accomProductIds.has(legacyProductId)
            ? "accommodation"
            : null,
      citizenship,
      pax: Number(pax) || 0,
      productName: nullOrString(activityName) || nullOrString(homestName) || null,
      totalRm: nullOrString(totalRm),
      totalNight: nullOrString(totalNight),
      status,
      date: nullOrString(date),
      createdAt,
      issuer: nullOrString(issuer),
      packageLegs,
    });
  }

  // ---- Emit -------------------------------------------------------------

  const header = `"use strict";

/**
 * GENERATED FILE — do not hand-edit.
 * Produced by scripts/parseLegacyDump.js from the legacy Kiulu system dump.
 * Every exclusion/reattachment/role decision here is documented in
 * docs/LEGACY_DB_MIGRATION_ANALYSIS.md and docs/COMPANIES_AND_USERS.md.
 * Regenerate with:
 *   node scripts/parseLegacyDump.js <dump.sql> > seeders/data/legacy-kiulu-seed-data.js
 */

`;

  const body =
    "module.exports = " +
    JSON.stringify({ companies, users, products, bookings }, null, 2) +
    ";\n";

  process.stdout.write(header + body);

  const summary = {
    sourceRtUserRows: rtUserRows.length,
    keptUsers: users.length,
    excludedTestAccounts: EXCLUDED_TEST_ACCOUNTS.size,
    excludedDummyCompanyUsers: EXCLUDED_DUMMY_COMPANY_USERS.size,
    companies: companies.length,
    products: products.length,
    sourceFormResponseRows: formResponseRows.length,
    keptBookings: bookings.length,
    skippedExcludedReceipts,
    bookingTypeCounts: bookings.reduce((acc, b) => {
      acc[b.bookingType] = (acc[b.bookingType] || 0) + 1;
      return acc;
    }, {}),
  };
  process.stderr.write("parseLegacyDump summary:\n");
  process.stderr.write(JSON.stringify(summary, null, 2) + "\n");
}

main();
