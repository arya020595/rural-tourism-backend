const { Op, fn, col, literal, where } = require("sequelize");
const Booking = require("../models/bookingModel");
const BookingPackageCompany = require("../models/bookingPackageCompanyModel");
const bookingsService = require("./bookingsService");

const FINAL_STATUSES = ["paid", "completed"];
const TYPE_KEYS = ["activity", "accommodation", "package"];
const TYPE_LABELS = {
  activity: "Activity",
  accommodation: "Accommodation",
  package: "Package",
};

class DashboardService {
  parseYyyyMmDd(value) {
    const str = String(value || "").trim();
    const match = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);

    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return { year, month, day };
  }

  parseYyyyMm(value) {
    const str = String(value || "").trim();
    const match = str.match(/^(\d{4})-(\d{2})$/);
    if (!match) return null;

    const year = Number(match[1]);
    const month = Number(match[2]);

    if (month < 1 || month > 12) return null;
    return { year, month };
  }

  buildUtcDate(year, month, day, endOfDay = false) {
    if (endOfDay) {
      return new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
    }
    return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  }

  getMonthEnd(date) {
    return new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0, 23, 59, 59, 999),
    );
  }

  formatAsYyyyMmDd(date) {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  buildMonthKeys(startDate, endDate) {
    const keys = [];
    let current = new Date(
      Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), 1),
    );
    const last = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), 1));

    while (current <= last) {
      const year = current.getUTCFullYear();
      const month = String(current.getUTCMonth() + 1).padStart(2, "0");
      keys.push(`${year}-${month}`);
      current = new Date(Date.UTC(year, current.getUTCMonth() + 1, 1));
    }

    return keys;
  }

  getEffectiveDateExpr() {
    return literal("COALESCE(receipt_created_at, updated_at, created_at)");
  }

  buildEffectiveDateWhere(startDate, endDate) {
    return where(this.getEffectiveDateExpr(), {
      [Op.between]: [startDate, endDate],
    });
  }

  async resolveActorContext(authUser) {
    return bookingsService.resolveActorContext(authUser);
  }

  baseWhere({ companyId, isSuperadmin, startDate, endDate }) {
    const whereClause = {
      status: { [Op.in]: FINAL_STATUSES },
      [Op.and]: [this.buildEffectiveDateWhere(startDate, endDate)],
    };

    if (!isSuperadmin) {
      whereClause.companyId = companyId;
      // A company's package figures come from the package items it provides
      // (aggregatePackageShare), not the whole package total.
      whereClause.bookingType = { [Op.ne]: "package" };
    }

    return whereClause;
  }

  async aggregateByType({ companyId, isSuperadmin, startDate, endDate }) {
    return Booking.findAll({
      attributes: [
        "bookingType",
        [fn("COALESCE", fn("SUM", col("total_price")), 0), "totalRevenue"],
        [fn("COUNT", col("id")), "totalReceipts"],
        [
          fn(
            "COALESCE",
            fn(
              "SUM",
              literal("COALESCE(no_of_pax_antarbangsa, 0) + COALESCE(no_of_pax_domestik, 0)"),
            ),
            0,
          ),
          "totalTourists",
        ],
      ],
      where: this.baseWhere({ companyId, isSuperadmin, startDate, endDate }),
      group: ["bookingType"],
      raw: true,
    });
  }

  async aggregateMonthlyByType({ companyId, isSuperadmin, startDate, endDate }) {
    return Booking.findAll({
      attributes: [
        [fn("DATE_FORMAT", this.getEffectiveDateExpr(), "%Y-%m"), "month"],
        "bookingType",
        [fn("COALESCE", fn("SUM", col("total_price")), 0), "totalRevenue"],
        [fn("COUNT", col("id")), "totalReceipts"],
        [
          fn(
            "COALESCE",
            fn(
              "SUM",
              literal("COALESCE(no_of_pax_antarbangsa, 0) + COALESCE(no_of_pax_domestik, 0)"),
            ),
            0,
          ),
          "totalTourists",
        ],
      ],
      where: this.baseWhere({ companyId, isSuperadmin, startDate, endDate }),
      group: [
        fn("DATE_FORMAT", this.getEffectiveDateExpr(), "%Y-%m"),
        "bookingType",
      ],
      order: [[literal("month"), "ASC"]],
      raw: true,
    });
  }

  /**
   * A company's share of package bookings: only the package items it
   * provides (`referee_id` = company) — in packages it created and in ones
   * other companies referred to it. Revenue is the sum of those items'
   * prices; each package counts once for receipts and tourists, however many
   * of the company's items it has. Grouped by month when `monthly`.
   */
  async aggregatePackageShare({ companyId, isSuperadmin, startDate, endDate, monthly = false }) {
    if (isSuperadmin || !companyId) return monthly ? [] : { revenue: 0, receipts: 0, tourists: 0 };

    const rows = await BookingPackageCompany.sequelize.query(`
      SELECT
        ${monthly ? "per_booking.month AS month," : ""}
        COALESCE(SUM(per_booking.revenue), 0) AS revenue,
        COUNT(*) AS receipts,
        COALESCE(SUM(per_booking.pax), 0) AS tourists
      FROM (
        SELECT
          b.id,
          DATE_FORMAT(COALESCE(b.receipt_created_at, b.updated_at, b.created_at), '%Y-%m') AS month,
          SUM(bpc.per_price) AS revenue,
          MAX(COALESCE(b.no_of_pax_antarbangsa, 0) + COALESCE(b.no_of_pax_domestik, 0)) AS pax
        FROM booking_package_companies bpc
        INNER JOIN bookings b ON b.id = bpc.booking_package_id
        WHERE bpc.referee_id = :companyId
          AND b.booking_type = 'package'
          AND b.status IN (:statuses)
          AND COALESCE(b.receipt_created_at, b.updated_at, b.created_at)
              BETWEEN :startDate AND :endDate
        GROUP BY b.id, month
      ) AS per_booking
      ${monthly ? "GROUP BY per_booking.month ORDER BY per_booking.month ASC" : ""}
    `, {
      replacements: { companyId, statuses: FINAL_STATUSES, startDate, endDate },
      type: BookingPackageCompany.sequelize.QueryTypes.SELECT,
    });

    if (monthly) return rows;
    const row = rows?.[0] || {};
    return {
      revenue: Number(row.revenue || 0),
      receipts: Number(row.receipts || 0),
      tourists: Number(row.tourists || 0),
    };
  }

  normalizeTypeSummary(rows) {
    const output = {
      activity: { totalRevenue: 0, totalReceipts: 0, totalTourists: 0 },
      accommodation: { totalRevenue: 0, totalReceipts: 0, totalTourists: 0 },
      package: { totalRevenue: 0, totalReceipts: 0, totalTourists: 0 },
    };

    rows.forEach((row) => {
      const type = row.bookingType;
      if (!TYPE_KEYS.includes(type)) return;

      output[type] = {
        totalRevenue: Number(row.totalRevenue || 0),
        totalReceipts: Number(row.totalReceipts || 0),
        totalTourists: Number(row.totalTourists || 0),
      };
    });

    return output;
  }

  toCombinedSummary(typeSummary) {
    return {
      totalRevenue:
        typeSummary.activity.totalRevenue +
        typeSummary.accommodation.totalRevenue +
        typeSummary.package.totalRevenue,
      totalReceipts:
        typeSummary.activity.totalReceipts +
        typeSummary.accommodation.totalReceipts +
        typeSummary.package.totalReceipts,
      totalTourists:
        typeSummary.activity.totalTourists +
        typeSummary.accommodation.totalTourists +
        typeSummary.package.totalTourists,
    };
  }

  toTodayCharts(typeSummary) {
    return {
      revenue: {
        activity: typeSummary.activity.totalRevenue,
        accommodation: typeSummary.accommodation.totalRevenue,
        package: typeSummary.package.totalRevenue,
      },
      receipts: {
        activity: typeSummary.activity.totalReceipts,
        accommodation: typeSummary.accommodation.totalReceipts,
        package: typeSummary.package.totalReceipts,
      },
      tourists: {
        activity: typeSummary.activity.totalTourists,
        accommodation: typeSummary.accommodation.totalTourists,
        package: typeSummary.package.totalTourists,
      },
    };
  }

  normalizeMonthlyMaps(monthKeys, rows) {
    const makeRow = (monthLabel) => ({
      month: monthLabel,
      activity: 0,
      accommodation: 0,
      package: 0,
    });

    const monthFormatter = new Intl.DateTimeFormat("en-US", {
      month: "short",
      timeZone: "UTC",
    });

    const monthNameMap = new Map();
    const revenueMap = new Map();
    const receiptsMap = new Map();
    const touristsMap = new Map();

    monthKeys.forEach((key) => {
      const monthName = monthFormatter.format(new Date(`${key}-01T00:00:00.000Z`));
      monthNameMap.set(key, monthName);
      revenueMap.set(key, makeRow(monthName));
      receiptsMap.set(key, makeRow(monthName));
      touristsMap.set(key, makeRow(monthName));
    });

    rows.forEach((row) => {
      const key = row.month;
      const type = row.bookingType;
      if (!monthNameMap.has(key) || !TYPE_KEYS.includes(type)) return;

      revenueMap.get(key)[type] = Number(row.totalRevenue || 0);
      receiptsMap.get(key)[type] = Number(row.totalReceipts || 0);
      touristsMap.get(key)[type] = Number(row.totalTourists || 0);
    });

    return {
      revenueTrend: monthKeys.map((key) => revenueMap.get(key)),
      receiptsTrend: monthKeys.map((key) => receiptsMap.get(key)),
      touristsTrend: monthKeys.map((key) => touristsMap.get(key)),
    };
  }

  resolveTodayRange(dateRaw) {
    if (dateRaw) {
      const dateParts = this.parseYyyyMmDd(dateRaw);
      if (!dateParts) {
        const error = new Error("Invalid date");
        error.statusCode = 400;
        throw error;
      }

      const start = this.buildUtcDate(dateParts.year, dateParts.month, dateParts.day);
      const end = this.buildUtcDate(dateParts.year, dateParts.month, dateParts.day, true);
      return { startDate: start, endDate: end, asOfDate: this.formatAsYyyyMmDd(start) };
    }

    // Malaysia-local "today", computed independent of the server process's
    // own TZ setting. `new Date()`'s local getFullYear/getMonth/getDate and
    // setHours all read/write the process's own local clock — local dev
    // happens to run with TZ=Asia/Kuala_Lumpur, but staging/production run in
    // UTC, so those calls silently returned UTC calendar values there,
    // showing "today" as one day behind for anything created between
    // Malaysia midnight and 8am. Malaysia has no DST, so a flat UTC+8 shift
    // on the current instant reliably yields the correct Malaysia-local Y/M/D
    // via UTC getters, regardless of the server's own TZ.
    const malaysiaNow = new Date(Date.now() + 8 * 60 * 60 * 1000);
    const year = malaysiaNow.getUTCFullYear();
    const month = malaysiaNow.getUTCMonth() + 1;
    const day = malaysiaNow.getUTCDate();

    const startDate = new Date(Date.UTC(year, month - 1, day, -8, 0, 0, 0));
    const endDate = new Date(Date.UTC(year, month - 1, day, 15, 59, 59, 999));

    return {
      startDate,
      endDate,
      asOfDate: this.formatAsYyyyMmDd(this.buildUtcDate(year, month, day)),
    };
  }

  async getTodayDashboard(authUser, dateRaw) {
    const actor = await this.resolveActorContext(authUser);
    const companyId = actor.companyId;
    const isSuperadmin = actor.isSuperadmin;
    const { startDate, endDate, asOfDate } = this.resolveTodayRange(dateRaw);

    const [summaryRows, packageShare] = await Promise.all([
      this.aggregateByType({ companyId, isSuperadmin, startDate, endDate }),
      this.aggregatePackageShare({ companyId, isSuperadmin, startDate, endDate }),
    ]);

    const typeSummary = this.normalizeTypeSummary(summaryRows);

    // Company: the package slice is its own items' share (package bookings
    // are excluded from aggregateByType). Superadmin: share is 0.
    typeSummary.package.totalRevenue += packageShare.revenue;
    typeSummary.package.totalReceipts += packageShare.receipts;
    typeSummary.package.totalTourists += packageShare.tourists;

    const combined = this.toCombinedSummary(typeSummary);

    return {
      asOfDate,
      summary: combined,
      charts: this.toTodayCharts(typeSummary),
    };
  }

  resolveTrendRange(fromRaw, toRaw) {
    const fromParts = this.parseYyyyMm(fromRaw);
    const toParts = this.parseYyyyMm(toRaw);

    if (!fromParts || !toParts) {
      const error = new Error("Invalid from/to format");
      error.statusCode = 400;
      throw error;
    }

    const startDate = this.buildUtcDate(fromParts.year, fromParts.month, 1);
    const endDate = this.getMonthEnd(this.buildUtcDate(toParts.year, toParts.month, 1));

    if (endDate < startDate) {
      const error = new Error("from must be less than or equal to to");
      error.statusCode = 400;
      throw error;
    }

    return {
      startDate,
      endDate,
      from: `${fromParts.year}-${String(fromParts.month).padStart(2, "0")}`,
      to: `${toParts.year}-${String(toParts.month).padStart(2, "0")}`,
    };
  }

  // Day-level range for getAssociationStats — returns null when no filter
  // is supplied so the all-time query (unfiltered join) still runs
  // unchanged. Validation (format, from<=to) already happened in
  // dashboardValidator.validateAssociationStatsQuery before this is called.
  resolveAssociationStatsRange(fromRaw, toRaw) {
    if (!fromRaw && !toRaw) return null;

    const fromParts = this.parseYyyyMmDd(fromRaw);
    const toParts = this.parseYyyyMmDd(toRaw);
    if (!fromParts || !toParts) {
      const error = new Error("Invalid from/to date");
      error.statusCode = 400;
      throw error;
    }

    const startDate = this.buildUtcDate(fromParts.year, fromParts.month, fromParts.day);
    const endDate = this.buildUtcDate(toParts.year, toParts.month, toParts.day, true);

    return { startDate, endDate };
  }

  async getTrendDashboard(authUser, fromRaw, toRaw) {
    const actor = await this.resolveActorContext(authUser);
    const companyId = actor.companyId;
    const isSuperadmin = actor.isSuperadmin;
    const { startDate, endDate, from, to } = this.resolveTrendRange(fromRaw, toRaw);

    const [summaryRows, monthlyRows, packageShare, packageShareMonthly] = await Promise.all([
      this.aggregateByType({ companyId, isSuperadmin, startDate, endDate }),
      this.aggregateMonthlyByType({ companyId, isSuperadmin, startDate, endDate }),
      this.aggregatePackageShare({ companyId, isSuperadmin, startDate, endDate }),
      this.aggregatePackageShare({ companyId, isSuperadmin, startDate, endDate, monthly: true }),
    ]);

    const typeSummary = this.normalizeTypeSummary(summaryRows);
    const monthKeys = this.buildMonthKeys(startDate, endDate);
    const trends = this.normalizeMonthlyMaps(monthKeys, monthlyRows);
    const combined = this.toCombinedSummary(typeSummary);
    combined.totalRevenue += packageShare.revenue;
    combined.totalReceipts += packageShare.receipts;
    combined.totalTourists += packageShare.tourists;

    // Company: the package line in each chart is its own items' share.
    const shareByMonth = new Map(packageShareMonthly.map((r) => [r.month, r]));
    const addShare = (trend, field) =>
      trend.map((row, i) => ({
        ...row,
        package: (row.package || 0) + Number(shareByMonth.get(monthKeys[i])?.[field] || 0),
      }));
    trends.revenueTrend = addShare(trends.revenueTrend, "revenue");
    trends.receiptsTrend = addShare(trends.receiptsTrend, "receipts");
    trends.touristsTrend = addShare(trends.touristsTrend, "tourists");

    return {
      range: {
        from,
        to,
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      },
      summary: combined,
      revenueTrend: trends.revenueTrend,
      receiptsTrend: trends.receiptsTrend,
      touristsTrend: trends.touristsTrend,
    };
  }

  /**
   * Superadmin-only: all-time per-association figures plus the companies in
   * each association.
   *
   * Metrics:
   *  - totalBookings  : ALL bookings (any status, cancelled included)
   *  - totalReceipts  : bookings with status = 'paid'
   *  - totalTourists  : sum of pax for status = 'paid' only (pending is
   *                     unconfirmed, so its pax are not counted)
   *  - totalCancelled : bookings with status = 'cancelled'
   *  - totalPending   : every other booking (not paid, not cancelled), so
   *                     pending + paid + cancelled = totalBookings
   *  - totalDeposit   : deposits of pending + cancelled bookings — money held
   *                     for bookings not paid in full yet, plus non-refundable
   *                     deposits kept from cancellations. Paid bookings are
   *                     left out: their deposit is part of totalRevenue.
   *
   * A company's association comes from its operator's `users.association_id`
   * (companies has no association_id). The subquery collapses each company to
   * a single association so bookings are counted once (no join fan-out when an
   * association has several operator users for the same company).
   */
  async getAssociationStats(fromRaw, toRaw) {
    const dateRange = this.resolveAssociationStatsRange(fromRaw, toRaw);

    const [statRows, staffRows, companyRows] = await Promise.all([
      Booking.sequelize.query(
        `
        SELECT
          a.id   AS associationId,
          a.name AS associationName,
          COUNT(b.id) AS totalBookings,
          COALESCE(SUM(b.status = 'paid'), 0) AS totalReceipts,
          COALESCE(
            SUM(
              CASE WHEN b.status = 'paid'
                THEN COALESCE(b.no_of_pax_antarbangsa, 0) + COALESCE(b.no_of_pax_domestik, 0)
                ELSE 0
              END
            ),
            0
          ) AS totalTourists,
          COALESCE(SUM(b.status = 'cancelled'), 0) AS totalCancelled,
          COALESCE(SUM(b.id IS NOT NULL AND b.status NOT IN ('paid', 'cancelled')), 0) AS totalPending,
          COALESCE(
            SUM(CASE WHEN b.status <> 'paid' THEN COALESCE(b.total_deposit, 0) ELSE 0 END),
            0
          ) AS totalDeposit,
          COALESCE(
            SUM(CASE WHEN b.status = 'paid' THEN b.total_price ELSE 0 END),
            0
          ) AS totalRevenue
        FROM associations a
        LEFT JOIN (
          SELECT company_id, MIN(association_id) AS association_id
          FROM users
          WHERE company_id IS NOT NULL AND association_id IS NOT NULL
          GROUP BY company_id
        ) ca ON ca.association_id = a.id
        LEFT JOIN bookings b
          ON b.company_id = ca.company_id
          ${dateRange ? "AND COALESCE(b.receipt_created_at, b.updated_at, b.created_at) BETWEEN :startDate AND :endDate" : ""}
        GROUP BY a.id, a.name
        ORDER BY a.name
        `,
        {
          type: Booking.sequelize.QueryTypes.SELECT,
          replacements: dateRange
            ? { startDate: dateRange.startDate, endDate: dateRange.endDate }
            : {},
        },
      ),
      // Full-time / part-time staff per association. Kept as its own query:
      // joining it into the bookings aggregate above would multiply the staff
      // counts by the number of bookings per company.
      Booking.sequelize.query(
        `
        SELECT
          ca.association_id AS associationId,
          COALESCE(SUM(c.total_fulltime_staff), 0) AS totalFulltimeStaff,
          COALESCE(SUM(c.total_partime_staff), 0)  AS totalParttimeStaff
        FROM (
          SELECT company_id, MIN(association_id) AS association_id
          FROM users
          WHERE company_id IS NOT NULL AND association_id IS NOT NULL
          GROUP BY company_id
        ) ca
        JOIN companies c ON c.id = ca.company_id
        GROUP BY ca.association_id
        `,
        { type: Booking.sequelize.QueryTypes.SELECT },
      ),
      // Companies per association (operator's association_id).
      Booking.sequelize.query(
        `
        SELECT
          ca.association_id AS associationId,
          c.id             AS companyId,
          c.company_name   AS companyName
        FROM (
          SELECT company_id, MIN(association_id) AS association_id
          FROM users
          WHERE company_id IS NOT NULL AND association_id IS NOT NULL
          GROUP BY company_id
        ) ca
        JOIN companies c ON c.id = ca.company_id
        ORDER BY ca.association_id, c.company_name
        `,
        { type: Booking.sequelize.QueryTypes.SELECT },
      ),
    ]);

    const staffByAssoc = new Map();
    staffRows.forEach((r) => {
      staffByAssoc.set(Number(r.associationId), {
        totalFulltimeStaff: Number(r.totalFulltimeStaff) || 0,
        totalParttimeStaff: Number(r.totalParttimeStaff) || 0,
      });
    });

    const companiesByAssoc = new Map();
    companyRows.forEach((r) => {
      const key = Number(r.associationId);
      if (!companiesByAssoc.has(key)) companiesByAssoc.set(key, []);
      companiesByAssoc.get(key).push({
        companyId: Number(r.companyId),
        companyName: r.companyName || "",
      });
    });

    const associations = statRows.map((r) => {
      const id = Number(r.associationId);
      const staff = staffByAssoc.get(id) || {
        totalFulltimeStaff: 0,
        totalParttimeStaff: 0,
      };
      return {
        associationId: id,
        associationName: r.associationName,
        totalBookings: Number(r.totalBookings) || 0,
        totalReceipts: Number(r.totalReceipts) || 0,
        totalTourists: Number(r.totalTourists) || 0,
        totalCancelled: Number(r.totalCancelled) || 0,
        totalPending: Number(r.totalPending) || 0,
        totalDeposit: Number(r.totalDeposit) || 0,
        // Paid bookings only — consistent with totalReceipts/totalTourists.
        totalRevenue: Number(r.totalRevenue) || 0,
        totalFulltimeStaff: staff.totalFulltimeStaff,
        totalParttimeStaff: staff.totalParttimeStaff,
        totalStaff: staff.totalFulltimeStaff + staff.totalParttimeStaff,
        companies: companiesByAssoc.get(id) || [],
      };
    });

    const totals = associations.reduce(
      (acc, a) => {
        acc.totalBookings += a.totalBookings;
        acc.totalReceipts += a.totalReceipts;
        acc.totalTourists += a.totalTourists;
        acc.totalCancelled += a.totalCancelled;
        acc.totalPending += a.totalPending;
        acc.totalDeposit += a.totalDeposit;
        acc.totalRevenue += a.totalRevenue;
        acc.totalFulltimeStaff += a.totalFulltimeStaff;
        acc.totalParttimeStaff += a.totalParttimeStaff;
        acc.totalStaff += a.totalStaff;
        return acc;
      },
      {
        totalBookings: 0,
        totalReceipts: 0,
        totalTourists: 0,
        totalCancelled: 0,
        totalPending: 0,
        totalDeposit: 0,
        totalRevenue: 0,
        totalFulltimeStaff: 0,
        totalParttimeStaff: 0,
        totalStaff: 0,
      },
    );

    return { associations, totals };
  }
}

module.exports = new DashboardService();
