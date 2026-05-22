"use strict";

const cron = require("node-cron");
const bookingReminderService = require("../services/bookingReminderService");

class BookingReminderScheduler {
  constructor() {
    this.task = null;
    this.isRunning = false;
  }

  /**
   * Start the daily cron job at midnight (Asia/Kuala_Lumpur).
   */
  start() {
    if (this.task) {
      console.log("[BookingReminderScheduler] Already running");
      return;
    }

    this.task = cron.schedule(
      "0 0 * * *",
      async () => {
        await this.executeTask();
      },
      {
        scheduled: true,
        timezone: process.env.TZ || "Asia/Kuala_Lumpur",
      },
    );

    console.log(
      `[BookingReminderScheduler] Started — runs daily at 00:00 (${process.env.TZ || "Asia/Kuala_Lumpur"})`,
    );
  }

  /**
   * Execute the reminder task.
   * Guards against overlapping runs with isRunning flag.
   */
  async executeTask() {
    if (this.isRunning) {
      console.log("[BookingReminderScheduler] Task already running, skipping");
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();

    console.log("[BookingReminderScheduler] ========================================");
    console.log(
      "[BookingReminderScheduler] Task started at:",
      new Date().toISOString(),
    );

    try {
      const result = await bookingReminderService.sendBookingReminders(3);
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);

      console.log(
        `[BookingReminderScheduler] Task completed in ${duration}s`,
      );
      console.log("[BookingReminderScheduler] Summary:", {
        targetDate: result.targetDate,
        bookingsFound: result.totalBookingsFound,
        notificationsSent: result.notificationsSent,
        errors: result.errors,
      });

      return result;
    } catch (err) {
      console.error("[BookingReminderScheduler] Task failed:", err.message);
      console.error("[BookingReminderScheduler] Stack:", err.stack);
    } finally {
      this.isRunning = false;
      console.log("[BookingReminderScheduler] ========================================");
    }
  }

  /**
   * Stop the scheduler gracefully (used on SIGTERM / SIGINT).
   */
  stop() {
    if (this.task) {
      this.task.stop();
      this.task = null;
      console.log("[BookingReminderScheduler] Stopped");
    }
  }

  /**
   * Manually trigger the task — used for testing without waiting for midnight.
   */
  async triggerNow() {
    console.log("[BookingReminderScheduler] Manual trigger requested");
    return await this.executeTask();
  }
}

module.exports = new BookingReminderScheduler();
