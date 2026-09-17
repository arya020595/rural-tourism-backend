const sequelize = require("../config/db");

/**
 * Read-only verification for the legacy Kiulu migration (see
 * docs/LEGACY_DB_MIGRATION_ANALYSIS.md §6 for the target numbers this
 * checks against, and §8.6/§8.7/§8.10/§8.11 for the exclusion lists).
 * Makes no writes. Run after seeders 20260915000001 through 000006.
 */

// Revenue and pax targets are PAID-ONLY, matching how the association
// dashboard (services/dashboardService.js getAssociationStats) scopes every
// figure — SUM(... WHERE status='paid'). An earlier version of these targets
// (and of docs/LEGACY_DB_MIGRATION_ANALYSIS.md §6) summed ALL package legs
// regardless of status, which double-counted voided package transactions as
// revenue (RM 972,497.99 vs the correct RM 946,992.99 — a real RM 25,505
// discrepancy traced directly against the live dashboard and confirmed to
// the cent). Corrected here; §6 should be corrected to match.
const TARGETS = {
  companies: 37,
  users: 54,
  bookings: 2210,
  paidBookings: 2077,
  cancelledBookings: 133,
  totalPaxPaid: 32078,
  nonPackagePaidRevenue: 890749.99,
  packagePaidRevenue: 56243.0,
  combinedPaidRevenue: 946992.99,
};

const EXCLUDED_TEST_ACCOUNT_LEGACY_IDS = [
  "U05339512",
  "U08812032",
  "U01241029",
  "U08459140",
];

const EXCLUDED_DUMMY_COMPANY_LEGACY_IDS = [
  "U00555452",
  "U03471116",
  "U01863056",
  "U08056368",
  "U02275515",
  "U03277513",
];

const SELECT = sequelize.QueryTypes.SELECT;

async function tableExists(tableName) {
  const rows = await sequelize.query("SHOW TABLES LIKE :tableName", {
    type: SELECT,
    replacements: { tableName },
  });
  return rows.length > 0;
}

async function countMapped(entity) {
  const rows = await sequelize.query(
    "SELECT COUNT(*) AS n FROM legacy_id_map WHERE entity = :entity",
    { type: SELECT, replacements: { entity } },
  );
  return Number(rows[0].n);
}

async function countDistinctMapped(entity) {
  const rows = await sequelize.query(
    "SELECT COUNT(DISTINCT new_id) AS n FROM legacy_id_map WHERE entity = :entity",
    { type: SELECT, replacements: { entity } },
  );
  return Number(rows[0].n);
}

const run = async () => {
  const report = { pass: [], fail: [], info: {} };

  const check = (label, actual, expected) => {
    const ok = actual === expected;
    report.info[label] = { actual, expected, ok };
    (ok ? report.pass : report.fail).push(label);
  };

  if (!(await tableExists("legacy_id_map"))) {
    throw new Error(
      "legacy_id_map table not found — has the migration seeder chain run yet?",
    );
  }

  // --- Row count targets (§6) ---------------------------------------

  check("companies_mapped", await countDistinctMapped("company"), TARGETS.companies);
  check("users_mapped", await countMapped("user"), TARGETS.users);

  const bookingIdsRows = await sequelize.query(
    "SELECT new_id FROM legacy_id_map WHERE entity = 'booking'",
    { type: SELECT },
  );
  const bookingIds = bookingIdsRows.map((r) => Number(r.new_id));
  check("bookings_mapped", bookingIds.length, TARGETS.bookings);

  if (bookingIds.length) {
    const statusRows = await sequelize.query(
      `SELECT status, COUNT(*) AS n FROM bookings
       WHERE id IN (:bookingIds) GROUP BY status`,
      { type: SELECT, replacements: { bookingIds } },
    );
    const statusCounts = Object.fromEntries(
      statusRows.map((r) => [r.status, Number(r.n)]),
    );
    check("bookings_paid", statusCounts.paid || 0, TARGETS.paidBookings);
    check(
      "bookings_cancelled",
      statusCounts.cancelled || 0,
      TARGETS.cancelledBookings,
    );

    // Paid-only throughout, matching the dashboard's own scoping
    // (services/dashboardService.js getAssociationStats: every aggregate is
    // SUM(... WHERE status = 'paid')) — a void/cancelled booking's pax and
    // price were never actually collected.
    const paxRow = await sequelize.query(
      `SELECT COALESCE(SUM(no_of_pax_antarbangsa + no_of_pax_domestik), 0) AS total_pax
       FROM bookings WHERE id IN (:bookingIds) AND status = 'paid'`,
      { type: SELECT, replacements: { bookingIds } },
    );
    check("total_pax_paid", Number(paxRow[0].total_pax), TARGETS.totalPaxPaid);

    const nonPackageRevenueRow = await sequelize.query(
      `SELECT COALESCE(SUM(total_price), 0) AS revenue
       FROM bookings
       WHERE id IN (:bookingIds) AND booking_type != 'package' AND status = 'paid'`,
      { type: SELECT, replacements: { bookingIds } },
    );
    check(
      "non_package_paid_revenue",
      Number(Number(nonPackageRevenueRow[0].revenue).toFixed(2)),
      TARGETS.nonPackagePaidRevenue,
    );

    // bookings.total_price on a package booking is already SUM(legs) (set
    // by the seeder and verified equal — see the migration's testing
    // notes), so paid package revenue reads directly off bookings, exactly
    // like the dashboard does, rather than re-summing
    // booking_package_companies.per_price across all statuses.
    const packageRevenueRow = await sequelize.query(
      `SELECT COALESCE(SUM(total_price), 0) AS revenue
       FROM bookings
       WHERE id IN (:bookingIds) AND booking_type = 'package' AND status = 'paid'`,
      { type: SELECT, replacements: { bookingIds } },
    );
    const packagePaidRevenue = Number(
      Number(packageRevenueRow[0].revenue).toFixed(2),
    );
    check("package_paid_revenue", packagePaidRevenue, TARGETS.packagePaidRevenue);
    check(
      "combined_paid_revenue",
      Number(
        (
          report.info.non_package_paid_revenue.actual + packagePaidRevenue
        ).toFixed(2),
      ),
      TARGETS.combinedPaidRevenue,
    );

    // --- Orphan-FK safety check (should be guaranteed by construction) --

    const orphanRows = await sequelize.query(
      `SELECT b.id
       FROM bookings b
       WHERE b.id IN (:bookingIds)
         AND (
           (b.user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = b.user_id))
           OR (b.company_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM companies c WHERE c.id = b.company_id))
           OR (b.product_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM products p WHERE p.id = b.product_id))
         )`,
      { type: SELECT, replacements: { bookingIds } },
    );
    check("orphan_fk_bookings", orphanRows.length, 0);
  }

  // --- legacy_id_map completeness (catches a partial/interrupted run) --

  const danglingRows = await sequelize.query(
    `SELECT m.entity, m.legacy_id, m.new_id
     FROM legacy_id_map m
     LEFT JOIN companies c ON m.entity = 'company' AND m.new_id = c.id
     LEFT JOIN users u ON m.entity = 'user' AND m.new_id = u.id
     LEFT JOIN products p ON m.entity = 'product' AND m.new_id = p.id
     LEFT JOIN bookings b ON m.entity = 'booking' AND m.new_id = b.id
     WHERE c.id IS NULL AND u.id IS NULL AND p.id IS NULL AND b.id IS NULL`,
    { type: SELECT },
  );
  check("dangling_legacy_id_map_rows", danglingRows.length, 0);

  // --- Exclusion spot-checks: nothing landed for excluded legacy users --

  const allExcluded = [
    ...EXCLUDED_TEST_ACCOUNT_LEGACY_IDS,
    ...EXCLUDED_DUMMY_COMPANY_LEGACY_IDS,
  ];
  const excludedStillMapped = await sequelize.query(
    `SELECT legacy_id FROM legacy_id_map WHERE entity = 'user' AND legacy_id IN (:allExcluded)`,
    { type: SELECT, replacements: { allExcluded } },
  );
  check("excluded_users_leaked", excludedStillMapped.length, 0);

  // --- Spot-check: Dapako Hill's reattached orphan products present ----

  const dapakoRow = await sequelize.query(
    `SELECT id FROM companies WHERE company_name = 'Dapako Hill - Lingga Eco Tourism' LIMIT 1`,
    { type: SELECT },
  );
  if (dapakoRow.length) {
    const walaiDapakoRow = await sequelize.query(
      `SELECT COUNT(*) AS n FROM products
       WHERE company_id = :companyId AND LOWER(name) LIKE '%walai dapako%'`,
      { type: SELECT, replacements: { companyId: dapakoRow[0].id } },
    );
    check(
      "dapako_hill_has_walai_dapako",
      Number(walaiDapakoRow[0].n) > 0 ? 1 : 0,
      1,
    );
  } else {
    report.fail.push("dapako_hill_company_not_found");
  }

  console.log(JSON.stringify(report, null, 2));
  if (report.fail.length) {
    throw new Error(`${report.fail.length} check(s) failed: ${report.fail.join(", ")}`);
  }
};

run()
  .catch((error) => {
    console.error(`Verification failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close();
  });
