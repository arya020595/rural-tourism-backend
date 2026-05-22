const { Op, fn, col, literal, where } = require("sequelize");
const Booking = require("../models/bookingModel");
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

  baseWhere({ userId, isSuperadmin, startDate, endDate }) {
    const whereClause = {
      status: { [Op.in]: FINAL_STATUSES },
      [Op.and]: [this.buildEffectiveDateWhere(startDate, endDate)],
    };

    if (!isSuperadmin) {
      whereClause.userId = userId;
    }

    return whereClause;
  }

  async aggregateByType({ userId, isSuperadmin, startDate, endDate }) {
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
      where: this.baseWhere({ userId, isSuperadmin, startDate, endDate }),
      group: ["bookingType"],
      raw: true,
    });
  }

  async aggregateMonthlyByType({ userId, isSuperadmin, startDate, endDate }) {
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
      where: this.baseWhere({ userId, isSuperadmin, startDate, endDate }),
      group: [
        fn("DATE_FORMAT", this.getEffectiveDateExpr(), "%Y-%m"),
        "bookingType",
      ],
      order: [[literal("month"), "ASC"]],
      raw: true,
    });
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

    const now = new Date();
    const startDate = new Date(now);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(now);
    endDate.setHours(23, 59, 59, 999);

    return {
      startDate,
      endDate,
      asOfDate: this.formatAsYyyyMmDd(
        new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())),
      ),
    };
  }

  async getTodayDashboard(authUser, dateRaw) {
    const actor = await this.resolveActorContext(authUser);
    const userId = actor.userId;
    const isSuperadmin = actor.isSuperadmin;
    const { startDate, endDate, asOfDate } = this.resolveTodayRange(dateRaw);

    const summaryRows = await this.aggregateByType({
      userId,
      isSuperadmin,
      startDate,
      endDate,
    });

    const typeSummary = this.normalizeTypeSummary(summaryRows);

    return {
      asOfDate,
      summary: this.toCombinedSummary(typeSummary),
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

  async getTrendDashboard(authUser, fromRaw, toRaw) {
    const actor = await this.resolveActorContext(authUser);
    const userId = actor.userId;
    const isSuperadmin = actor.isSuperadmin;
    const { startDate, endDate, from, to } = this.resolveTrendRange(fromRaw, toRaw);

    const [summaryRows, monthlyRows] = await Promise.all([
      this.aggregateByType({ userId, isSuperadmin, startDate, endDate }),
      this.aggregateMonthlyByType({ userId, isSuperadmin, startDate, endDate }),
    ]);

    const typeSummary = this.normalizeTypeSummary(summaryRows);
    const monthKeys = this.buildMonthKeys(startDate, endDate);
    const trends = this.normalizeMonthlyMaps(monthKeys, monthlyRows);

    return {
      range: {
        from,
        to,
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      },
      summary: this.toCombinedSummary(typeSummary),
      revenueTrend: trends.revenueTrend,
      receiptsTrend: trends.receiptsTrend,
      touristsTrend: trends.touristsTrend,
    };
  }
}

module.exports = new DashboardService();
