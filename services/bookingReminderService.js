"use strict";

const { Op, where, fn, col } = require("sequelize");
const Booking = require("../models/bookingModel");
const Notification = require("../models/notificationModel");
const { BadRequestError } = require("./errors/AppError");
const NOTIFICATION_TYPES = require("../constants/notificationTypes");

class BookingReminderService {
  /**
   * Find all bookings happening exactly N days from today.
   * Covers activity bookings (activityDate) and accommodation bookings (checkInDate).
   * Uses DATE() cast on activityDate because it is stored as DATETIME in MySQL,
   * so a plain string comparison would never match bookings with a time component.
   */
  async findUpcomingBookings(daysAhead = 3) {
    const target = new Date();
    target.setDate(target.getDate() + daysAhead);
    const targetDate = target.toISOString().split("T")[0]; // YYYY-MM-DD

    console.log(`[BookingReminderService] Querying bookings for: ${targetDate}`);

    const bookings = await Booking.findAll({
      where: {
        [Op.or]: [
          where(fn("DATE", col("activity_date")), targetDate), // DATETIME field — must cast to DATE
          { checkInDate: targetDate },                          // DATEONLY field — plain comparison works
        ],
        status: {
          [Op.notIn]: ["cancelled", "rejected"],
        },
      },
    });

    console.log(
      `[BookingReminderService] Found ${bookings.length} upcoming bookings`,
    );
    return { bookings, targetDate };
  }

  /**
   * Create a single booking reminder notification for an operator.
   */
  async createBookingReminder(bookingData, operatorId) {
    if (!operatorId) throw new BadRequestError("Operator ID is required");

    const { touristName, bookingType, productName, bookingId, bookingDate } = bookingData;

    const dateLabel = bookingDate
      ? ` (${new Date(bookingDate + "T00:00:00").toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })})`
      : "";

    const title = "Upcoming Booking";
    let message;

    if (bookingType === "activity") {
      message = `${touristName} has an activity booking in 3 days${dateLabel}.`;
    } else if (bookingType === "accommodation") {
      message = `${touristName} checks in to ${productName} in 3 days${dateLabel}.`;
    } else {
      // covers 'package' and any future types
      message = `${touristName} has a booking in 3 days${dateLabel}.`;
    }

    const notification = await Notification.create({
      user_id: operatorId,
      user_type: "operator",
      title,
      message,
      type: NOTIFICATION_TYPES.BOOKING_REMINDER,
      related_id: bookingId,
      is_read: 0,
    });

    console.log(
      `[BookingReminderService] Notification created — operator: ${operatorId}, booking: ${bookingId}`,
    );
    return notification;
  }

  /**
   * Main orchestration method called by the cron scheduler.
   * Loops all upcoming bookings and creates one reminder per operator per booking.
   */
  async sendBookingReminders(daysAhead = 3) {
    console.log(
      `[BookingReminderService] Starting reminder process (${daysAhead} days ahead)`,
    );

    const { bookings, targetDate } = await this.findUpcomingBookings(daysAhead);

    const sent = [];
    const errors = [];
    const seen = new Map(); // dedup within this run: key = "operatorId-bookingId"

    for (const booking of bookings) {
      try {
        const operatorId = booking.userId;
        const touristName = booking.touristFullName || "Guest";
        const productName = booking.productName || "Booking";
        const bookingType = booking.bookingType; // 'activity' | 'accommodation' | 'package'

        if (!operatorId) {
          console.warn(
            `[BookingReminderService] Skipping booking ${booking.id}: no operatorId`,
          );
          continue;
        }

        const key = `${operatorId}-${booking.id}`;
        if (seen.has(key)) continue;

        const notification = await this.createBookingReminder(
          { touristName, bookingType, productName, bookingId: booking.id, bookingDate: targetDate },
          operatorId,
        );

        sent.push(notification);
        seen.set(key, true);
      } catch (err) {
        console.error(
          `[BookingReminderService] Error on booking ${booking.id}:`,
          err.message,
        );
        errors.push({ bookingId: booking.id, error: err.message });
      }
    }

    const summary = {
      targetDate,
      totalBookingsFound: bookings.length,
      notificationsSent: sent.length,
      errors: errors.length,
      errorDetails: errors,
    };

    console.log(`[BookingReminderService] Done:`, JSON.stringify(summary, null, 2));
    return summary;
  }
}

module.exports = new BookingReminderService();
