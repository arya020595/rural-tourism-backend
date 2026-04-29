const { Op, fn, col, literal, where } = require("sequelize");
const Booking = require("../models/bookingModel");
const bookingsService = require("./bookingsService");

const FINAL_STATUSES = ["paid", "completed"];
const BOOKING_TYPE_KEYS = ["activity", "accommodation", "package"];

const TYPE_LABELS = {
  activity: "Activity Booking",
  accommodation: "Accommodation Booking",
  package: "Booking Package",
};

const TYPE_RESPONSE_KEYS = {
  activity: "activityBooking",
  accommodation: "accommodationBooking",
  package: "bookingPackage",
};

class DashboardService {
  parseDateParts(value) {
    const str = String(value || "").trim();
    const match = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);

    if (month < 1 || month > 12 || day < 1 || day > 31) return null;

    return { year, month, day };
  }

  buildUtcDate(year, month, day, endOfDay = false) {
    if (endOfDay) {
      return new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
    }
    return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  }

  getMonthStart(date) {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  }

  getMonthEnd(date) {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0, 23, 59, 59, 999));
  }

  buildMonthKeys(startDate, endDate) {
    const keys = [];
    let current = this.getMonthStart(startDate);
    const last = this.getMonthStart(endDate);

    while (current <= last) {
      const year = current.getUTCFullYear();
      const month = String(current.getUTCMonth() + 1).padStart(2, "0");
      keys.push(`${year}-${month}`);
      current = new Date(Date.UTC(year, current.getUTCMonth() + 1, 1));
    }

    return keys;
  }

  normalizeMetricRows(rows) {
    const base = {
      activityBooking: { totalRevenue: 0, totalReceipt: 0, totalTourist: 0 },
      accommodationBooking: { totalRevenue: 0, totalReceipt: 0, totalTourist: 0 },
      bookingPackage: { totalRevenue: 0, totalReceipt: 0, totalTourist: 0 },
    };

    rows.forEach((row) => {
      const type = row.bookingType;
      if (!TYPE_RESPONSE_KEYS[type]) return;

      const key = TYPE_RESPONSE_KEYS[type];
      base[key] = {
        totalRevenue: Number(row.totalRevenue || 0),
        totalReceipt: Number(row.totalReceipt || 0),
        totalTourist: Number(row.totalTourist || 0),
      };
    });

    return base;
  }

  getEffectiveDateExpr() {
    return literal("COALESCE(receipt_created_at, updated_at, created_at)");
  }

  buildEffectiveDateWhere(startDate, endDate) {
    return where(this.getEffectiveDateExpr(), {
      [Op.between]: [startDate, endDate],
    });
  }

  async resolveOperatorId(authUser) {
    const actor = await bookingsService.resolveActorContext(authUser);
    return actor.userId;
  }

  async aggregateByType({ userId, startDate, endDate }) {
    return Booking.findAll({
      attributes: [
        "bookingType",
        [fn("COALESCE", fn("SUM", col("total_price")), 0), "totalRevenue"],
        [fn("COUNT", col("id")), "totalReceipt"],
        [
          fn(
            "COALESCE",
            fn(
              "SUM",
              literal("COALESCE(no_of_pax_antarbangsa, 0) + COALESCE(no_of_pax_domestik, 0)"),
            ),
            0,
          ),
          "totalTourist",
        ],
      ],
      where: {
        userId,
        status: { [Op.in]: FINAL_STATUSES },
        [Op.and]: [this.buildEffectiveDateWhere(startDate, endDate)],
      },
      group: ["bookingType"],
      raw: true,
    });
  }

  async aggregateMonthlyByType({ userId, startDate, endDate }) {
    return Booking.findAll({
      attributes: [
        [fn("DATE_FORMAT", this.getEffectiveDateExpr(), "%Y-%m"), "month"],
        "bookingType",
        [fn("COALESCE", fn("SUM", col("total_price")), 0), "totalRevenue"],
        [fn("COUNT", col("id")), "totalReceipt"],
        [
          fn(
            "COALESCE",
            fn(
              "SUM",
              literal("COALESCE(no_of_pax_antarbangsa, 0) + COALESCE(no_of_pax_domestik, 0)"),
            ),
            0,
          ),
          "totalTourist",
        ],
      ],
      where: {
        userId,
        status: { [Op.in]: FINAL_STATUSES },
        [Op.and]: [this.buildEffectiveDateWhere(startDate, endDate)],
      },
      group: [fn("DATE_FORMAT", this.getEffectiveDateExpr(), "%Y-%m"), "bookingType"],
      order: [[literal("month"), "ASC"]],
      raw: true,
    });
  }

  buildTodayMetadata(summary) {
    const bookingTypes = BOOKING_TYPE_KEYS.map((type) => ({
      type: TYPE_LABELS[type],
      key: TYPE_RESPONSE_KEYS[type],
    }));

    return {
      revenueByBookingType: bookingTypes.map((item) => ({
        type: item.type,
        value: summary[item.key].totalRevenue,
      })),
      receiptByBookingType: bookingTypes.map((item) => ({
        type: item.type,
        value: summary[item.key].totalReceipt,
      })),
      touristByBookingType: bookingTypes.map((item) => ({
        type: item.type,
        value: summary[item.key].totalTourist,
      })),
    };
  }

  buildTrendMetadata(monthKeys, rows) {
    const monthFormatter = new Intl.DateTimeFormat("en-US", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });

    const zeroRow = (month) => ({
      month,
      name: monthFormatter.format(new Date(`${month}-01T00:00:00.000Z`)),
      activityBooking: 0,
      accommodationBooking: 0,
      bookingPackage: 0,
    });

    const revenueMap = new Map();
    const receiptMap = new Map();
    const touristMap = new Map();

    monthKeys.forEach((month) => {
      revenueMap.set(month, zeroRow(month));
      receiptMap.set(month, zeroRow(month));
      touristMap.set(month, zeroRow(month));
    });

    rows.forEach((row) => {
      const month = row.month;
      const key = TYPE_RESPONSE_KEYS[row.bookingType];
      if (!month || !key || !revenueMap.has(month)) return;

      revenueMap.get(month)[key] = Number(row.totalRevenue || 0);
      receiptMap.get(month)[key] = Number(row.totalReceipt || 0);
      touristMap.get(month)[key] = Number(row.totalTourist || 0);
    });

    return {
      revenueTrend: monthKeys.map((month) => revenueMap.get(month)),
      receiptTrend: monthKeys.map((month) => receiptMap.get(month)),
      touristTrend: monthKeys.map((month) => touristMap.get(month)),
    };
  }

  async getTodayDashboard(authUser, now = new Date()) {
    const userId = await this.resolveOperatorId(authUser);

    const startDate = new Date(now);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(now);
    endDate.setHours(23, 59, 59, 999);

    const rows = await this.aggregateByType({ userId, startDate, endDate });
    const summary = this.normalizeMetricRows(rows);

    return {
      summary,
      metadata: this.buildTodayMetadata(summary),
      range: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      },
    };
  }

  async getTrendDashboard(authUser, startRaw, endRaw) {
    const startParts = this.parseDateParts(startRaw);
    const endParts = this.parseDateParts(endRaw);

    if (!startParts || !endParts) {
      const error = new Error("Invalid start/end date");
      error.statusCode = 400;
      throw error;
    }

    const startDate = this.buildUtcDate(
      startParts.year,
      startParts.month,
      startParts.day,
    );
    const endDate = this.getMonthEnd(
      this.buildUtcDate(endParts.year, endParts.month, endParts.day),
    );

    if (endDate < startDate) {
      const error = new Error("end month must be on or after start date");
      error.statusCode = 400;
      throw error;
    }

    const userId = await this.resolveOperatorId(authUser);
    const [summaryRows, monthlyRows] = await Promise.all([
      this.aggregateByType({ userId, startDate, endDate }),
      this.aggregateMonthlyByType({ userId, startDate, endDate }),
    ]);

    const summary = this.normalizeMetricRows(summaryRows);
    const monthKeys = this.buildMonthKeys(startDate, endDate);

    return {
      summary,
      metadata: this.buildTrendMetadata(monthKeys, monthlyRows),
      range: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      },
    };
  }
}

module.exports = new DashboardService();
