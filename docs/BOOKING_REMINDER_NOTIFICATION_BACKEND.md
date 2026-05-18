# Backend Technical Documentation: Booking Reminder Notification System

**Feature**: Automated 3-Day Advance Booking Reminders for Operators  
**Version**: 1.0  
**Date**: May 7, 2026  
**Author**: Development Team

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Phase 1: Infrastructure Setup](#phase-1-infrastructure-setup)
4. [Phase 2: Database Query Logic](#phase-2-database-query-logic)
5. [Phase 3: Notification Creation](#phase-3-notification-creation)
6. [Phase 4: Testing & Validation](#phase-4-testing--validation)
7. [Deployment Guide](#deployment-guide)
8. [Troubleshooting](#troubleshooting)

---

## Overview

### Purpose

Automatically notify operators 3 days before their customers' bookings via in-app notifications displayed in the bell icon.

### Target Users

- **Operators only** (business owners managing bookings)
- Identified by `user_type = 'operator'` in notifications table

### Scope

- **Booking Types**: Activity bookings, Accommodation bookings, Package bookings
- **Notification Channel**: In-app database records only (no email, no push notifications)
- **Schedule**: Daily execution at midnight (00:00 server time)
- **Delivery**: Pull-based (frontend polls for updates every 60 seconds)

### Technical Requirements

- Node.js 14+ with Express
- Sequelize ORM with MySQL
- Existing notification infrastructure (notifications table)
- Server must support cron job execution

---

## Architecture

### System Flow — End to End

```
══════════════════════════════════════════════════════════════════════════════
  BACKEND (Node.js / Express)              DATABASE (MySQL)
══════════════════════════════════════════════════════════════════════════════

  ┌──────────────────────────────────┐
  │  CRON JOB — daily at 00:00       │
  │  scripts/bookingReminderScheduler│
  └────────────────┬─────────────────┘
                   │ triggers
                   ▼
  ┌──────────────────────────────────┐       ┌──────────────────────┐
  │  NotificationService             │       │  bookings table      │
  │  .sendBookingReminders(3)        │──────▶│                      │
  │                                  │       │  WHERE               │
  │  1. findUpcomingBookings()       │       │    date = +3 days    │
  │     → Single OR query            │       │    OR check_in_date  │
  │                                  │◀──────│    = +3 days         │
  │  2. Loop each booking            │       │  AND status NOT IN   │
  │     → detect type                │       │    (cancelled,       │
  │       date? → activity           │       │     rejected)        │
  │       check_in_date? → accomm    │       └──────────────────────┘
  │     → deduplicate by             │
  │       operatorId + bookingId     │       ┌──────────────────────┐
  │                                  │       │  notifications table  │
  │  3. createBookingReminder()      │──────▶│                      │
  │     → Notification.create()      │       │  INSERT              │
  │       user_type: 'operator'      │       │  user_id (operator)  │
  │       is_read: 0                 │       │  title, message      │
  └──────────────────────────────────┘       │  type, related_id    │
                                             │  is_read = 0         │
                                             └──────────────────────┘

══════════════════════════════════════════════════════════════════════════════
  FRONTEND (Angular / Ionic)               BACKEND API (Express Routes)
══════════════════════════════════════════════════════════════════════════════

  ┌──────────────────────────────────┐
  │  App starts / User logs in       │
  │  app.component.ts                │
  └────────────────┬─────────────────┘
                   │
                   ▼
  ┌──────────────────────────────────┐
  │  NotificationService             │
  │  (Angular service, singleton)    │
  │                                  │
  │  BehaviorSubject<number>         │
  │  unreadCount$ ──────────────────────────────────────────────┐
  └────────────────┬─────────────────┘                          │
                   │                                            │ subscribes
                   │ starts                                     │
                   ▼                                            ▼
  ┌──────────────────────────────────┐         ┌───────────────────────────┐
  │  Polling Timer (every 60s)       │         │  home.page.ts             │
  │  interval(60_000)                │         │                           │
  │      │                          │         │  this.unreadCount$ ──────▶ │
  │      │ GET /unread-count         │         │  *ngIf="unreadCount > 0"  │
  │      ▼                          │         │  shows red badge on 🔔    │
  │  GET /api/notifications          │         └───────────────────────────┘
  │      /operator/:id/unread-count  │
  │                                  │──────▶  Backend API
  │  ◀── { unread_count: N }         │◀──────  GET /operator/:id/unread-count
  │                                  │
  │  unreadCountSubject.next(N)      │
  └──────────────────────────────────┘

                   │ user taps bell icon
                   ▼
  ┌──────────────────────────────────┐
  │  notifications.page.ts           │
  │  ionViewWillEnter()              │
  │      │                          │
  │      │ GET /notifications        │
  │      ▼                          │
  │  GET /api/notifications          │──────▶  Backend API
  │      /operator/:id               │◀──────  GET /operator/:id
  │                                  │         returns notifications[]
  │  ◀── { notifications: [...] }    │
  │                                  │
  │  Render list:                    │
  │  • Unread items at top           │
  │  • Title + short message         │
  │  • Timestamp                     │
  └────────────────┬─────────────────┘
                   │ user taps item
                   ▼
  ┌──────────────────────────────────┐
  │  markAsRead(id)                  │
  │      │                          │
  │      │ PATCH /:id/read           │
  │      ▼                          │
  │  PATCH /api/notifications/:id    │──────▶  Backend API
  │       /read                      │◀──────  PATCH /:id/read
  │                                  │
  │  unreadCountSubject              │
  │    .next(current - 1)            │──────▶  Badge updates instantly
  └──────────────────────────────────┘         (no extra API call needed)
```

---

### Frontend Bell Icon State Machine

```
  App launches
       │
       ▼
  ┌─────────────┐    count = 0     ┌──────────────────┐
  │  Poll API   │─────────────────▶│  Bell: no badge  │
  │  every 60s  │                  │  🔔              │
  └──────┬──────┘                  └──────────────────┘
         │
         │ count > 0
         ▼
  ┌──────────────────┐
  │  Bell: red badge │
  │  🔔 [3]          │◀─────────────────────────────────┐
  └────────┬─────────┘                                  │
           │                                            │
           │ user taps bell                             │
           ▼                                            │
  ┌──────────────────┐                                  │
  │  Open panel      │                                  │
  │  GET full list   │                                  │
  └────────┬─────────┘                                  │
           │                                            │
           │ user taps notification                     │
           ▼                                            │
  ┌──────────────────┐   PATCH /read     ┌──────────────┴───┐
  │  Mark as read    │──────────────────▶│  DB: is_read = 1 │
  │  (local + API)   │                   └──────────────────┘
  └────────┬─────────┘
           │
           │ unreadCount$ decrements
           ▼
  ┌──────────────────┐
  │  Badge updates   │
  │  immediately     │──────────────────────────────────▶ (back to top)
  └──────────────────┘
```

---

### Component Architecture

```
  Angular App
  ─────────────────────────────────────────────────────────
  app.component.ts
    └── injects NotificationService (singleton)
          │
          │  shared state via BehaviorSubject
          │
          ├── home.page.ts
          │     subscribes to unreadCount$
          │     renders bell icon + badge in toolbar
          │
          └── notifications.page.ts
                calls getNotifications() on page enter
                calls markAsRead() on item tap
                calls markAllAsRead() on "mark all" button

  NotificationService (services/notification.service.ts)
  ─────────────────────────────────────────────────────────
  State:
    unreadCountSubject: BehaviorSubject<number>   ← single source of truth
    unreadCount$: Observable<number>              ← all components subscribe

  Methods:
    getUnreadCount(operatorId)    → GET /operator/:id/unread-count
                                   → updates unreadCountSubject
    getNotifications(operatorId)  → GET /operator/:id
                                   → updates unreadCountSubject (full sync)
    markAsRead(id)                → PATCH /:id/read
                                   → decrements unreadCountSubject locally
    markAllAsRead(operatorId)     → PATCH /operator/:id/read-all
                                   → sets unreadCountSubject to 0

  Polling (to be wired in app.component.ts or home.page.ts):
    interval(60_000).pipe(
      switchMap(() => this.notificationService.getUnreadCount(uid))
    ).subscribe()
```

### Database Schema

**Existing `notifications` table** (no modifications needed):

```sql
CREATE TABLE notifications (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  user_type ENUM('tourist', 'operator') NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  type VARCHAR(50),
  related_id BIGINT,
  is_read TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### Key Components

| Component     | File Path                                | Responsibility                                               |
| ------------- | ---------------------------------------- | ------------------------------------------------------------ |
| **Scheduler** | `scripts/bookingReminderScheduler.js`    | Triggers daily cron job at midnight                          |
| **Service**   | `services/notificationService.js`        | Business logic for finding bookings & creating notifications |
| **Constants** | `constants/notificationTypes.js`         | Notification type definitions                                |
| **Models**    | `models/notificationModel.js`            | Database model (existing, reused)                            |
| **Tests**     | `tests/unit/notificationService.test.js` | Unit tests for service methods                               |

---

## Phase 1: Infrastructure Setup

### Step 1.1: Install node-cron

**Command:**

```bash
cd /home/arya020595/Documents/work/rural-tourism-new/rural-tourism-backend
npm install node-cron --save
```

**Expected Output:**

```
+ node-cron@3.0.3
added 1 package from 2 contributors
```

**Verification:**

```bash
grep "node-cron" package.json
# Should output: "node-cron": "^3.0.3"
```

---

### Step 1.2: Create Notification Service

**File:** `services/notificationService.js`

```javascript
const { Op } = require("sequelize");
const moment = require("moment");
const Booking = require("../models/bookingModel");
const Notification = require("../models/notificationModel");
const User = require("../models/userModel"); // rt_users table
const Company = require("../models/companyModel"); // companies table (optional)
const { NotFoundError, BadRequestError } = require("./errors/AppError");
const NOTIFICATION_TYPES = require("../constants/notificationTypes");

class NotificationService {
  /**
   * Find all bookings happening in N days from now
   * @param {number} daysAhead - Number of days to look ahead (default: 3)
   * @returns {Promise<Object>} Object containing bookings array and targetDate
   */
  async findUpcomingBookings(daysAhead = 3) {
    const targetDate = moment().add(daysAhead, "days").format("YYYY-MM-DD");

    console.log(
      `[NotificationService] Finding bookings for date: ${targetDate}`,
    );

    try {
      // SINGLE QUERY: Query unified bookings table
      // Handles both activity bookings (date field) and accommodation bookings (check_in_date field)
      const bookings = await Booking.findAll({
        where: {
          [Op.or]: [
            { date: targetDate }, // Activity bookings
            { check_in_date: targetDate }, // Accommodation bookings
          ],
          status: {
            [Op.notIn]: ["cancelled", "rejected"],
          },
        },
        include: [
          {
            model: User,
            as: "operator",
            attributes: ["UniqueID", "name", "email", "company_id"],
            required: false,
          },
          {
            model: Company,
            as: "company",
            attributes: ["UniqueID", "company_name"],
            required: false,
          },
        ],
        order: [
          ["date", "ASC"],
          ["check_in_date", "ASC"],
        ],
      });

      console.log(
        `[NotificationService] Found ${bookings.length} total bookings for ${targetDate}`,
      );

      const activityCount = bookings.filter((b) => b.date).length;
      const accommodationCount = bookings.filter(
        (b) => b.check_in_date && !b.date,
      ).length;
      console.log(
        `[NotificationService] Breakdown: ${activityCount} activity, ${accommodationCount} accommodation`,
      );

      return { bookings, targetDate };
    } catch (error) {
      console.error(
        "[NotificationService] Error finding upcoming bookings:",
        error,
      );
      throw error;
    }
  }

  /**
   * Create a single booking reminder notification for an operator
   * @param {Object} bookingData - Booking details
   * @param {number} operatorId - ID of the operator to notify
   * @returns {Promise<Object>} Created notification record
   */
  async createBookingReminder(bookingData, operatorId) {
    if (!operatorId) {
      throw new BadRequestError("Operator ID is required");
    }

    const { touristName, bookingType, bookingDate, bookingId, productName } =
      bookingData;

    // Short messages: keep under 80 chars, no long date strings
    const title = "Upcoming Booking";
    let message;
    if (bookingType === "activity") {
      message = `${touristName} has an activity booking in 3 days.`;
    } else if (bookingType === "accommodation") {
      message = `${touristName} checks in to ${productName} in 3 days.`;
    } else {
      message = `${touristName} has a booking in 3 days.`;
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
      `[NotificationService] Notification created for operator ${operatorId}, booking ${bookingId}`,
    );
    return notification;
  }

  /**
   * Process all upcoming bookings and send reminders
   * Main orchestration method called by cron job
   * @param {number} daysAhead - Number of days to look ahead (default: 3)
   * @returns {Promise<Object>} Summary of notifications sent
   */
  async sendBookingReminders(daysAhead = 3) {
    console.log(
      `[NotificationService] Starting booking reminder process for ${daysAhead} days ahead`,
    );

    try {
      const { bookings, targetDate } =
        await this.findUpcomingBookings(daysAhead);

      const notificationsSent = [];
      const errors = [];
      const operatorNotifications = new Map(); // Deduplicate by operator+booking

      for (const booking of bookings) {
        try {
          const operatorId = booking.user_id;
          const touristName = booking.tourist_full_name || "Guest";
          const productName = booking.product_name || "Booking";

          // Determine booking type based on which date field is populated
          let bookingType = "booking";
          let bookingDate = null;

          if (booking.date) {
            bookingType = "activity";
            bookingDate = booking.date;
          } else if (booking.check_in_date) {
            bookingType = "accommodation";
            bookingDate = booking.check_in_date;
          }

          if (!operatorId) {
            console.warn(
              `[NotificationService] Skipping booking ${booking.UniqueID}: No operator ID found`,
            );
            continue;
          }

          if (!bookingDate) {
            console.warn(
              `[NotificationService] Skipping booking ${booking.UniqueID}: No valid date field found`,
            );
            continue;
          }

          // Deduplicate: only one notification per operator per booking
          const key = `${operatorId}-${booking.UniqueID}`;
          if (!operatorNotifications.has(key)) {
            const notification = await this.createBookingReminder(
              {
                touristName,
                bookingType,
                bookingDate,
                bookingId: booking.UniqueID,
                productName,
              },
              operatorId,
            );

            notificationsSent.push(notification);
            operatorNotifications.set(key, notification);
          }
        } catch (err) {
          console.error(
            `[NotificationService] Error processing booking ${booking.UniqueID}:`,
            err,
          );
          errors.push({ bookingId: booking.UniqueID, error: err.message });
        }
      }

      const activityCount = bookings.filter((b) => b.date).length;
      const accommodationCount = bookings.filter(
        (b) => b.check_in_date && !b.date,
      ).length;

      const summary = {
        targetDate,
        totalBookingsFound: bookings.length,
        notificationsSent: notificationsSent.length,
        errors: errors.length,
        breakdown: {
          activities: activityCount,
          accommodations: accommodationCount,
        },
        errorDetails: errors,
      };

      console.log(
        `[NotificationService] Reminder process complete:`,
        JSON.stringify(summary, null, 2),
      );
      return summary;
    } catch (error) {
      console.error(
        "[NotificationService] Fatal error in sendBookingReminders:",
        error,
      );
      throw error;
    }
  }
}

module.exports = new NotificationService();
```

**Key Design Decisions:**

1. **Singleton Pattern**: Export single instance to ensure consistent state
2. **Error Handling**: Individual booking failures don't stop the entire process
3. **Deduplication**: Uses Map to prevent duplicate notifications for same operator+booking
4. **Logging**: Comprehensive console logs for monitoring and debugging
5. **Unified Query**: Single database query handles both activity and accommodation bookings using OR condition on date fields
6. **Moment.js**: Used for consistent date formatting (already in package.json)

---

### Step 1.3: Create Notification Type Constants

**File:** `constants/notificationTypes.js`

```javascript
/**
 * Notification Type Constants
 * Centralized list of all notification types in the system
 */

module.exports = {
  // Booking-related notifications
  BOOKING_REMINDER: "booking_reminder",
  BOOKING_CONFIRMATION: "booking_confirmation",
  BOOKING_CANCELLED: "booking_cancelled",
  BOOKING_UPDATED: "booking_updated",

  // Payment notifications
  PAYMENT_RECEIVED: "payment_received",
  PAYMENT_FAILED: "payment_failed",

  // System notifications
  SYSTEM_ANNOUNCEMENT: "system_announcement",
  ACCOUNT_UPDATE: "account_update",
};
```

**Usage Pattern:**

```javascript
const NOTIFICATION_TYPES = require("../constants/notificationTypes");

// Instead of:
type: "booking_reminder";

// Use:
type: NOTIFICATION_TYPES.BOOKING_REMINDER;
```

**Benefits:**

- Type safety (autocomplete in IDE)
- Easy refactoring (change constant, updates everywhere)
- Self-documenting code
- Prevents typos

---

### Step 1.4: Create Scheduler Script

**File:** `scripts/bookingReminderScheduler.js`

```javascript
const cron = require("node-cron");
const notificationService = require("../services/notificationService");

/**
 * Booking Reminder Scheduler
 * Runs daily at midnight (00:00) to send 3-day advance booking reminders
 *
 * Cron Pattern: '0 0 * * *'
 *   - Minute: 0
 *   - Hour: 0
 *   - Day of Month: * (every day)
 *   - Month: * (every month)
 *   - Day of Week: * (every day of week)
 */

class BookingReminderScheduler {
  constructor() {
    this.task = null;
    this.isRunning = false;
  }

  /**
   * Start the scheduler
   */
  start() {
    if (this.task) {
      console.log("[BookingReminderScheduler] Scheduler already running");
      return;
    }

    // Schedule cron job: daily at midnight
    this.task = cron.schedule(
      "0 0 * * *",
      async () => {
        await this.executeTask();
      },
      {
        scheduled: true,
        timezone: process.env.TZ || "Asia/Kuala_Lumpur", // Adjust to your timezone
      },
    );

    console.log(
      "[BookingReminderScheduler] ✅ Booking reminder scheduler started (runs daily at 00:00)",
    );
    console.log(
      "[BookingReminderScheduler] Timezone:",
      process.env.TZ || "Asia/Kuala_Lumpur",
    );
  }

  /**
   * Execute the reminder task
   * Called by cron job or manually for testing
   */
  async executeTask() {
    if (this.isRunning) {
      console.log(
        "[BookingReminderScheduler] Task already running, skipping this execution",
      );
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();

    console.log(
      "[BookingReminderScheduler] ========================================",
    );
    console.log(
      "[BookingReminderScheduler] Starting booking reminder task at:",
      new Date().toISOString(),
    );

    try {
      const result = await notificationService.sendBookingReminders(3);

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(
        "[BookingReminderScheduler] ✅ Task completed successfully in",
        duration,
        "seconds",
      );
      console.log("[BookingReminderScheduler] Summary:", {
        targetDate: result.targetDate,
        bookingsFound: result.totalBookingsFound,
        notificationsSent: result.notificationsSent,
        errors: result.errors,
      });

      return result;
    } catch (error) {
      console.error(
        "[BookingReminderScheduler] ❌ Task failed with error:",
        error,
      );
      console.error("[BookingReminderScheduler] Stack trace:", error.stack);

      // Don't throw - allow scheduler to continue for next run
      // In production, send alert to monitoring service (e.g., Sentry, CloudWatch)
    } finally {
      this.isRunning = false;
      console.log(
        "[BookingReminderScheduler] ========================================",
      );
    }
  }

  /**
   * Stop the scheduler (for graceful shutdown)
   */
  stop() {
    if (this.task) {
      this.task.stop();
      this.task = null;
      console.log("[BookingReminderScheduler] Scheduler stopped");
    }
  }

  /**
   * Manually trigger the task (for testing)
   */
  async triggerNow() {
    console.log("[BookingReminderScheduler] Manual trigger requested");
    return await this.executeTask();
  }
}

module.exports = new BookingReminderScheduler();
```

**Cron Pattern Explanation:**

```
'0 0 * * *'
 │ │ │ │ │
 │ │ │ │ └─── Day of week (0-7, Sunday = 0 or 7)
 │ │ │ └───── Month (1-12)
 │ │ └─────── Day of month (1-31)
 │ └───────── Hour (0-23)
 └─────────── Minute (0-59)
```

**Alternative Schedules:**

```javascript
"0 9 * * *"; // Daily at 9:00 AM
"0 */6 * * *"; // Every 6 hours
"0 0 * * 1"; // Every Monday at midnight
"*/30 * * * *"; // Every 30 minutes (testing)
```

---

### Step 1.5: Integrate Scheduler into Server

**File:** `server.js` (or `bin/www`)

**Modification:**

```javascript
// ... existing imports ...
const db = require("./config/db");
const bookingReminderScheduler = require("./scripts/bookingReminderScheduler");

// ... existing app setup ...

// Database connection
db.authenticate()
  .then(() => {
    console.log("Database connection has been established successfully.");

    // Start booking reminder scheduler AFTER database is ready
    if (process.env.NODE_ENV !== "test") {
      bookingReminderScheduler.start();
    }
  })
  .catch((err) => {
    console.error("Unable to connect to the database:", err);
    process.exit(1);
  });

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down gracefully");
  bookingReminderScheduler.stop();
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("SIGINT received, shutting down gracefully");
  bookingReminderScheduler.stop();
  process.exit(0);
});

// ... rest of server code ...
```

**Important Notes:**

1. **Start after DB connection**: Ensures models are loaded before scheduler runs
2. **Skip in test environment**: Prevents cron jobs during unit tests
3. **Graceful shutdown**: Stops scheduler cleanly on process termination
4. **Environment check**: Use `NODE_ENV` to control scheduler behavior

**Verification:**

```bash
npm start
# Should see: "✅ Booking reminder scheduler started (runs daily at 00:00)"
```

---

## Phase 2: Database Query Logic

### Step 2.1: Understanding Unified Bookings Table

**Table Structure (based on ERD):**

```sql
CREATE TABLE bookings (
  UniqueID BIGINT PRIMARY KEY AUTO_INCREMENT,
  tourist_full_name VARCHAR(255),
  citizenship VARCHAR(100),
  no_of_pax_antarabangsa INT,
  no_of_pax_domestik INT,
  product_id INT,
  product_name VARCHAR(255),
  date DATE,                      -- For activity bookings
  time VARCHAR(10),               -- Activity time (HH:MM format)
  total_price DECIMAL(10,2),
  user_id INT,                    -- Operator ID (FK to users.UniqueID)
  user_fullname VARCHAR(255),     -- Operator name (denormalized)
  check_in_date DATE,             -- For accommodation bookings
  check_out_date DATE,            -- For accommodation bookings
  total_of_night INT,             -- Number of nights
  status VARCHAR(50),             -- pending|confirmed|paid|cancelled|rejected
  reciept_created_at TIMESTAMP,
  operator_name VARCHAR(255),
  company_id INT,                 -- FK to companies
  company_name VARCHAR(255),      -- Denormalized
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

**Model Relationships:**

```javascript
// Booking Model (unified bookings table)
Booking.belongsTo(User, {
  foreignKey: "user_id",
  as: "operator",
});

Booking.belongsTo(Company, {
  foreignKey: "company_id",
  as: "company",
});

Booking.belongsTo(Product, {
  foreignKey: "product_id",
  as: "product",
});
```

**Date Field Logic:**

| Booking Type      | Date Field Used | Logic                                                                   |
| ----------------- | --------------- | ----------------------------------------------------------------------- |
| **Activity**      | `date`          | If `date` IS NOT NULL, it's an activity booking                         |
| **Accommodation** | `check_in_date` | If `check_in_date` IS NOT NULL (and `date` is NULL), it's accommodation |
| **Mixed**         | Both fields     | Some bookings might have both (package deals)                           |

**Query Strategy:**

```javascript
// Single query with OR condition handles both types
WHERE (date = targetDate OR check_in_date = targetDate)
  AND status NOT IN ('cancelled', 'rejected')
```

---

### Step 2.2: Query Optimization

**Recommended Indexes:**

```sql
-- Index for activity bookings query
CREATE INDEX idx_bookings_date_status
ON bookings(date, status);

-- Index for accommodation bookings query
CREATE INDEX idx_bookings_checkin_status
ON bookings(check_in_date, status);

-- Composite index for both (covers both date fields)
CREATE INDEX idx_bookings_dates_status
ON bookings(date, check_in_date, status);

-- Index for operator lookup
CREATE INDEX idx_bookings_user_id
ON bookings(user_id);
```

**Migration File:** `migrations/YYYYMMDDHHMMSS-add-booking-reminder-indexes.js`

```javascript
"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Index for date field (activity bookings)
    await queryInterface.addIndex("bookings", ["date", "status"], {
      name: "idx_bookings_date_status",
    });

    // Index for check_in_date field (accommodation bookings)
    await queryInterface.addIndex("bookings", ["check_in_date", "status"], {
      name: "idx_bookings_checkin_status",
    });

    // Index for operator lookup
    await queryInterface.addIndex("bookings", ["user_id"], {
      name: "idx_bookings_user_id",
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeIndex("bookings", "idx_bookings_date_status");
    await queryInterface.removeIndex("bookings", "idx_bookings_checkin_status");
    await queryInterface.removeIndex("bookings", "idx_bookings_user_id");
  },
};
```

**Run Migration:**

```bash
npx sequelize-cli db:migrate
```

---

### Step 2.3: Handling Edge Cases

**Edge Case Scenarios:**

1. **Missing Operator Information**
   - **Issue**: Some bookings may not have proper operator associations
   - **Solution**: Skip booking with warning log, don't crash entire process
   - **Code**: Already handled in service with `if (!operatorId) continue;`

2. **Deleted/Inactive Tourist**
   - **Issue**: Tourist user may have been deleted
   - **Solution**: Use fallback name 'Guest' if tourist not found
   - **Code**: `const touristName = booking.tourist?.full_name || 'Guest';`

3. **Timezone Differences**
   - **Issue**: Server timezone may differ from business timezone
   - **Solution**: Set `TZ` environment variable in `.env` or scheduler config
   - **Code**: Already configured in scheduler `timezone` option

4. **Duplicate Notifications**
   - **Issue**: Same booking processed twice if scheduler runs multiple times
   - **Solution**:
     - Use Map for in-memory deduplication (current implementation)
     - Add DB unique constraint (future enhancement):
       ```sql
       CREATE UNIQUE INDEX idx_notifications_unique_reminder
       ON notifications(type, related_id, DATE(created_at))
       WHERE type = 'booking_reminder';
       ```

5. **Large Dataset Performance**
   - **Issue**: Thousands of bookings may slow down query
   - **Solution**:
     - Add pagination to query (process in batches of 100)
     - Use indexes (Step 2.2)
     - Consider using `Notification.bulkCreate()` instead of individual inserts

---

## Phase 3: Notification Creation

### Step 3.1: Notification Message Templates

> **Design Principle**: Keep messages short and scannable. The `message` field is `VARCHAR(255)` and the app displays one to two lines of text in the notification list — avoid long sentences.

**Recommended Short Format:**

```javascript
// Title: short label (action keyword)
const title = "Upcoming Booking";

// Message: one clear sentence — who, what, when
const message = `${touristName} has a ${bookingType} in 3 days.`;

// Examples (activity):
// title:   "Upcoming Booking"
// message: "Ahmad Razif has an activity in 3 days."

// Examples (accommodation):
// title:   "Upcoming Booking"
// message: "Siti Aminah checks in to Sunset Villa in 3 days."
```

**Implementation in `createBookingReminder()`:**

```javascript
const title = "Upcoming Booking";

let message;
if (bookingType === "activity") {
  message = `${touristName} has an activity booking in 3 days.`;
} else if (bookingType === "accommodation") {
  message = `${touristName} checks in to ${productName} in 3 days.`;
} else {
  message = `${touristName} has a booking in 3 days.`;
}
```

**Character count guide (stay under ~80 chars for clean display):**

| Scenario      | Message                                            | Chars |
| ------------- | -------------------------------------------------- | ----- |
| Activity      | "Ahmad Razif has an activity booking in 3 days."   | 48    |
| Accommodation | "Siti Aminah checks in to Sunset Villa in 3 days." | 50    |
| Fallback      | "Guest has a booking in 3 days."                   | 31    |

---

### Step 3.2: Example API Payload

**Endpoint:** `POST /api/notifications`

**Headers:**

```
Authorization: Bearer <token>
Content-Type: application/json
```

**Activity Booking Reminder:**

```json
{
  "user_id": 12,
  "title": "Upcoming Booking",
  "message": "Ahmad Razif has an activity booking in 3 days.",
  "type": "booking_reminder",
  "related_id": 305
}
```

**Accommodation Booking Reminder:**

```json
{
  "user_id": 15,
  "title": "Upcoming Booking",
  "message": "Siti Aminah checks in to Sunset Villa in 3 days.",
  "type": "booking_reminder",
  "related_id": 412
}
```

**Success Response `201 Created`:**

```json
{
  "success": true,
  "message": "Notification created successfully",
  "data": {
    "notification": {
      "id": 88,
      "user_id": 12,
      "user_type": "operator",
      "title": "Upcoming Booking",
      "message": "Ahmad Razif has an activity booking in 3 days.",
      "type": "booking_reminder",
      "related_id": 305,
      "is_read": false,
      "created_at": "2026-05-07T00:00:01.000Z",
      "updated_at": "2026-05-07T00:00:01.000Z"
    }
  }
}
```

**Error Response `400 Bad Request`** (missing required fields):

```json
{
  "success": false,
  "message": "user_id, title, and related_id are required.",
  "error_code": 400,
  "data": {}
}
```

**Error Response `403 Forbidden`** (creating for a different user):

```json
{
  "success": false,
  "message": "Forbidden. You can only create notifications for your own account.",
  "error_code": 403,
  "data": {}
}
```

**Field Reference:**

| Field        | Type    | Required | Description                                                         |
| ------------ | ------- | -------- | ------------------------------------------------------------------- |
| `user_id`    | integer | ✅       | Operator's user ID (`users.UniqueID`)                               |
| `title`      | string  | ✅       | Short label shown in notification header                            |
| `message`    | string  | —        | Short display message (keep under 80 chars)                         |
| `type`       | string  | —        | `booking_reminder` \| `booking_confirmation` \| `booking_cancelled` |
| `related_id` | integer | ✅       | Booking ID (`bookings.UniqueID`) for deep linking                   |

> **Note**: `user_type` is NOT sent in the request body — the `createNotification` controller does not accept it from the client. The scheduler sets it directly via `Notification.create()` inside the service.

**Response Standard (all endpoints):**

All responses follow the format:

```json
{
  "success": true | false,
  "message": "Human-readable message",
  "error_code": 400,
  "data": {}
}
```

- `error_code` is only present on error responses.
- `data` is always present — `{}` on errors, named-key object on success.

**Other Endpoint Response Examples:**

`GET /api/notifications/operator/:id` → `200 OK`

```json
{
  "success": true,
  "message": "Data found",
  "data": {
    "notifications": [
      {
        "id": 88,
        "user_id": 12,
        "title": "Upcoming Booking",
        "message": "Ahmad Razif has an activity booking in 3 days.",
        "type": "booking_reminder",
        "related_id": 305,
        "is_read": false,
        "created_at": "2026-05-07T00:00:01.000Z"
      }
    ]
  }
}
```

`GET /api/notifications/operator/:id/unread-count` → `200 OK`

```json
{
  "success": true,
  "message": "Data found",
  "data": {
    "unread_count": 3
  }
}
```

`PATCH /api/notifications/:id/read` → `200 OK`

```json
{
  "success": true,
  "message": "Notification marked as read",
  "data": {}
}
```

---

### Step 3.3: Polling API for Frontend

The frontend polls the backend on a fixed interval (every 60 seconds) to check for new notifications. Two endpoints drive this:

| Purpose                 | Endpoint                                           | Called every                  |
| ----------------------- | -------------------------------------------------- | ----------------------------- |
| Badge count (bell icon) | `GET /api/notifications/operator/:id/unread-count` | 60 seconds                    |
| Full notification list  | `GET /api/notifications/operator/:id`              | On page open / manual refresh |

**Why two endpoints?**

- The **unread count** call is lightweight — returns a single integer, cheap to run on a timer.
- The **full list** call is heavier — only fetched when the user opens the notification panel or pulls to refresh.

---

#### Endpoint 1 — Unread Count (for bell badge)

**`GET /api/notifications/operator/:operator_id/unread-count`**

Called every 60 seconds by the frontend to update the red badge on the bell icon.

**Headers:**

```
Authorization: Bearer <token>
```

**Path Params:**

| Param         | Type    | Description                      |
| ------------- | ------- | -------------------------------- |
| `operator_id` | integer | The logged-in operator's user ID |

**Success Response `200 OK`:**

```json
{
  "success": true,
  "message": "Data found",
  "data": {
    "unread_count": 3
  }
}
```

**Frontend usage:** Read `data.unread_count`. If `> 0`, show the badge on the bell icon.

---

#### Endpoint 2 — Full Notification List (for notification panel)

**`GET /api/notifications/operator/:operator_id`**

Called when the user opens the notification panel or performs a pull-to-refresh.

**Headers:**

```
Authorization: Bearer <token>
```

**Path Params:**

| Param         | Type    | Description                      |
| ------------- | ------- | -------------------------------- |
| `operator_id` | integer | The logged-in operator's user ID |

**Success Response `200 OK`:**

```json
{
  "success": true,
  "message": "Data found",
  "data": {
    "notifications": [
      {
        "id": 88,
        "user_id": 12,
        "user_type": "operator",
        "title": "Upcoming Booking",
        "message": "Ahmad Razif has an activity booking in 3 days.",
        "type": "booking_reminder",
        "related_id": 305,
        "is_read": false,
        "created_at": "2026-05-07T00:00:01.000Z",
        "updated_at": "2026-05-07T00:00:01.000Z"
      },
      {
        "id": 85,
        "user_id": 12,
        "user_type": "operator",
        "title": "Upcoming Booking",
        "message": "Siti Aminah checks in to Sunset Villa in 3 days.",
        "type": "booking_reminder",
        "related_id": 298,
        "is_read": true,
        "created_at": "2026-05-06T00:00:01.000Z",
        "updated_at": "2026-05-06T08:10:00.000Z"
      }
    ]
  }
}
```

**Frontend usage:** Render `data.notifications`. Split by `is_read` to show unread items at the top.

**Empty state `200 OK`:**

```json
{
  "success": true,
  "message": "Data found",
  "data": {
    "notifications": []
  }
}
```

---

#### Polling Flow Diagram

```
Frontend (every 60s)                   Backend
        │                                   │
        │── GET /operator/:id/unread-count ─▶│
        │◀─ { unread_count: 3 } ────────────│
        │                                   │
        │  (user opens bell panel)          │
        │── GET /operator/:id ─────────────▶│
        │◀─ { notifications: [...] } ───────│
        │                                   │
        │  (user taps a notification)       │
        │── PATCH /:id/read ───────────────▶│
        │◀─ { success: true } ──────────────│
        │                                   │
        │── GET /operator/:id/unread-count ─▶│  (re-sync badge)
        │◀─ { unread_count: 2 } ────────────│
```

#### Error Responses (both endpoints)

**`401 Unauthorized`** — token missing or expired:

```json
{
  "success": false,
  "message": "Unauthorized",
  "error_code": 401,
  "data": {}
}
```

**`403 Forbidden`** — accessing another user's notifications:

```json
{
  "success": false,
  "message": "Forbidden",
  "error_code": 403,
  "data": {}
}
```

---

### Step 3.4: Adding Email Notifications (Optional Enhancement)

**Extend EmailService:**

**File:** `services/emailService.js`

Add new method:

```javascript
async sendBookingReminderEmail(operatorEmail, bookingData) {
  const { touristName, bookingType, bookingDate, additionalInfo } = bookingData;

  const subject = 'Upcoming Booking Reminder - Rural Tourism Sabah';

  const htmlTemplate = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #2d5016; color: white; padding: 20px; text-align: center; }
        .content { background: #f9f9f9; padding: 20px; margin: 20px 0; }
        .booking-info { background: white; padding: 15px; border-left: 4px solid #2d5016; }
        .footer { text-align: center; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2>Upcoming Booking Reminder</h2>
        </div>
        <div class="content">
          <p>Hello,</p>
          <p>This is a friendly reminder that you have an upcoming booking in 3 days:</p>
          <div class="booking-info">
            <p><strong>Guest:</strong> ${touristName}</p>
            <p><strong>Booking Type:</strong> ${bookingType}</p>
            <p><strong>Date:</strong> ${moment(bookingDate).format('MMMM DD, YYYY')}</p>
            ${additionalInfo ? `<p><strong>Details:</strong> ${additionalInfo}</p>` : ''}
          </div>
          <p>Please ensure everything is prepared for your guest's arrival.</p>
        </div>
        <div class="footer">
          <p>Rural Tourism Sabah | This is an automated reminder</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const plainText = `
Upcoming Booking Reminder

Guest: ${touristName}
Booking Type: ${bookingType}
Date: ${moment(bookingDate).format('MMMM DD, YYYY')}
${additionalInfo ? 'Details: ' + additionalInfo : ''}

Please ensure everything is prepared for your guest's arrival.

---
Rural Tourism Sabah | This is an automated reminder
  `.trim();

  return this.sendEmail({
    to: operatorEmail,
    subject,
    text: plainText,
    html: htmlTemplate
  });
}
```

**Integrate into NotificationService:**

Modify `createBookingReminder()` to send email:

```javascript
async createBookingReminder(bookingData, operatorId, operatorEmail = null) {
  // ... existing notification creation code ...

  // Send email if email is provided and email service is configured
  if (operatorEmail && process.env.SMTP_HOST) {
    try {
      await emailService.sendBookingReminderEmail(operatorEmail, bookingData);
      console.log(`[NotificationService] Email sent to ${operatorEmail}`);
    } catch (emailError) {
      console.error(`[NotificationService] Failed to send email to ${operatorEmail}:`, emailError);
      // Don't fail notification creation if email fails
    }
  }

  return notification;
}
```

**Environment Variables Required:**

```bash
# .env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
EMAIL_FROM=noreply@ruraltourismsabah.com
```

---

## Phase 4: Testing & Validation

### Step 4.1: Unit Tests

**File:** `tests/unit/notificationService.test.js`

```javascript
const notificationService = require("../../services/notificationService");
const Booking = require("../../models/bookingModel");
const Notification = require("../../models/notificationModel");
const User = require("../../models/userModel");
const moment = require("moment");

// Mock Sequelize models
jest.mock("../../models/bookingModel");
jest.mock("../../models/notificationModel");
jest.mock("../../models/userModel");

describe("NotificationService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("findUpcomingBookings", () => {
    it("should find bookings 3 days ahead", async () => {
      const targetDate = moment().add(3, "days").format("YYYY-MM-DD");

      // Mock unified bookings table results
      const mockBookings = [
        {
          UniqueID: 1,
          date: targetDate,
          status: "confirmed",
          tourist_full_name: "John Doe",
          product_name: "Jungle Trek",
          user_id: 100,
        },
        {
          UniqueID: 2,
          check_in_date: targetDate,
          status: "confirmed",
          tourist_full_name: "Jane Smith",
          product_name: "Beach Resort",
          user_id: 101,
          total_of_night: 2,
        },
      ];

      Booking.findAll.mockResolvedValue(mockBookings);

      const result = await notificationService.findUpcomingBookings(3);

      expect(result.targetDate).toBe(targetDate);
      expect(result.bookings).toHaveLength(2);

      // Verify single query was called with correct conditions
      expect(Booking.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            [expect.any(Symbol)]: [
              // Op.or
              { date: targetDate },
              { check_in_date: targetDate },
            ],
          }),
        }),
      );
    });

    it("should exclude cancelled bookings", async () => {
      Booking.findAll.mockResolvedValue([]);

      await notificationService.findUpcomingBookings(3);

      // Verify status filter is applied
      expect(Booking.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: expect.objectContaining({
              [expect.any(Symbol)]: ["cancelled", "rejected"], // Op.notIn
            }),
          }),
        }),
      );
    });
  });

  describe("createBookingReminder", () => {
    it("should create notification with correct fields", async () => {
      const bookingData = {
        touristName: "John Doe",
        bookingType: "activity",
        bookingDate: "2026-05-10",
        bookingId: 123,
        productName: "Jungle Trekking",
      };

      const mockNotification = {
        id: 1,
        user_id: 456,
        user_type: "operator",
        title: "Upcoming Booking",
        message: expect.stringContaining("John Doe"),
        // e.g. "John Doe has an activity booking in 3 days."
        type: "booking_reminder",
        related_id: 123,
        is_read: 0,
      };

      Notification.create.mockResolvedValue(mockNotification);

      const result = await notificationService.createBookingReminder(
        bookingData,
        456,
      );

      expect(Notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 456,
          user_type: "operator",
          type: "booking_reminder",
          related_id: 123,
          is_read: 0,
        }),
      );

      expect(result).toEqual(mockNotification);
    });

    it("should throw error if operator ID is missing", async () => {
      const bookingData = {
        touristName: "John Doe",
        bookingType: "activity",
        bookingDate: "2026-05-10",
        bookingId: 123,
      };

      await expect(
        notificationService.createBookingReminder(bookingData, null),
      ).rejects.toThrow("Operator ID is required");
    });
  });

  describe("sendBookingReminders", () => {
    it("should process all bookings and return summary", async () => {
      const mockActivityBooking = {
        UniqueID: 1,
        date: "2026-05-10",
        status: "confirmed",
        tourist_full_name: "John Doe",
        product_name: "Jungle Trekking",
        user_id: 100,
        operator: { UniqueID: 100, name: "Operator Name" },
      };

      const mockAccommodationBooking = {
        UniqueID: 2,
        check_in_date: "2026-05-10",
        check_out_date: "2026-05-12",
        total_of_night: 2,
        status: "confirmed",
        tourist_full_name: "Jane Smith",
        product_name: "Sunset Villa",
        user_id: 101,
        operator: { UniqueID: 101, name: "Hotel Owner" },
      };

      Booking.findAll.mockResolvedValue([
        mockActivityBooking,
        mockAccommodationBooking,
      ]);
      Notification.create.mockResolvedValue({ id: 1 });

      const result = await notificationService.sendBookingReminders(3);

      expect(result.totalBookingsFound).toBe(2);
      expect(result.notificationsSent).toBe(2);
      expect(result.errors).toBe(0);
      expect(result.breakdown).toEqual({
        activities: 1,
        accommodations: 1,
      });
    });

    it("should handle errors gracefully", async () => {
      const mockBooking = {
        UniqueID: 1,
        date: "2026-05-10",
        tourist_full_name: "John Doe",
        product_name: "Trekking",
        user_id: 100,
        operator: { UniqueID: 100, name: "Operator" },
      };

      Booking.findAll.mockResolvedValue([mockBooking]);
      Notification.create.mockRejectedValue(new Error("DB Error"));

      const result = await notificationService.sendBookingReminders(3);

      expect(result.errors).toBe(1);
      expect(result.errorDetails).toHaveLength(1);
      expect(result.errorDetails[0]).toMatchObject({
        bookingId: 1,
        error: "DB Error",
      });
    });
  });
});
```

**Run Tests:**

```bash
npm run test:unit -- notificationService.test.js
```

**Expected Output:**

```
 PASS  tests/unit/notificationService.test.js
  NotificationService
    findUpcomingBookings
      ✓ should find bookings 3 days ahead (25ms)
      ✓ should exclude cancelled bookings (10ms)
    createBookingReminder
      ✓ should create notification with correct fields (15ms)
      ✓ should throw error if operator ID is missing (8ms)
    sendBookingReminders
      ✓ should process all bookings and return summary (20ms)
      ✓ should handle errors gracefully (18ms)

Test Suites: 1 passed, 1 total
Tests:       6 passed, 6 total
```

---

### Step 4.2: Manual Testing with Console

**Using the REPL:**

```bash
node scripts/console.js
```

**In the console:**

```javascript
// Load service
const notificationService = require("./services/notificationService");

// Test finding bookings
const bookings = await notificationService.findUpcomingBookings(3);
console.log(JSON.stringify(bookings, null, 2));

// Test creating a single reminder
const result = await notificationService.createBookingReminder(
  {
    touristName: "Test User",
    bookingType: "activity",
    bookingDate: "2026-05-10",
    bookingId: 999,
    productName: "Jungle Trekking",
  },
  1,
); // operator_id = 1

console.log(result);

// Test full process
const summary = await notificationService.sendBookingReminders(3);
console.log(summary);

// Verify in database
const Notification = require("./models/notificationModel");
const notifications = await Notification.findAll({
  where: { type: "booking_reminder" },
  order: [["created_at", "DESC"]],
  limit: 10,
});

console.table(
  notifications.map((n) => ({
    id: n.id,
    operator_id: n.user_id,
    title: n.title,
    message: n.message.substring(0, 50) + "...",
    is_read: n.is_read,
    created_at: n.created_at,
  })),
);
```

---

### Step 4.3: Integration Testing

**Create Test Data:**

```sql
-- Insert test activity booking 3 days in future
INSERT INTO bookings (
  tourist_full_name,
  citizenship,
  no_of_pax_domestik,
  product_id,
  product_name,
  date,              -- Activity date
  time,
  total_price,
  user_id,           -- Operator ID
  status,
  company_id,
  created_at,
  updated_at
) VALUES (
  'Test User Activity',
  'Malaysian',
  2,
  1,
  'Jungle Trekking Experience',
  DATE_ADD(CURDATE(), INTERVAL 3 DAY),
  '09:00',
  150.00,
  1,  -- Replace with actual operator user_id
  'confirmed',
  1,  -- Replace with actual company_id
  NOW(),
  NOW()
);

-- Insert test accommodation booking 3 days in future
INSERT INTO bookings (
  tourist_full_name,
  citizenship,
  no_of_pax_domestik,
  product_id,
  product_name,
  check_in_date,     -- Accommodation check-in
  check_out_date,
  total_of_night,
  total_price,
  user_id,           -- Operator ID
  status,
  company_id,
  created_at,
  updated_at
) VALUES (
  'Test User Accommodation',
  'Singaporean',
  2,
  5,
  'Sunset Beach Villa',
  DATE_ADD(CURDATE(), INTERVAL 3 DAY),
  DATE_ADD(CURDATE(), INTERVAL 5 DAY),
  2,
  300.00,
  2,  -- Replace with actual operator user_id
  'confirmed',
  2,  -- Replace with actual company_id
  NOW(),
  NOW()
);

-- Verify bookings created
SELECT
  UniqueID,
  tourist_full_name,
  product_name,
  date AS activity_date,
  check_in_date,
  status
FROM bookings
WHERE (date = DATE_ADD(CURDATE(), INTERVAL 3 DAY)
   OR check_in_date = DATE_ADD(CURDATE(), INTERVAL 3 DAY))
  AND status = 'confirmed';
```

**Trigger Scheduler Manually:**

```bash
node -e "
const scheduler = require('./scripts/bookingReminderScheduler');
scheduler.triggerNow().then(() => process.exit(0));
"
```

**Verify Notifications Created:**

```sql
SELECT
  n.id,
  n.user_id AS operator_id,
  n.title,
  n.message,
  n.type,
  n.related_id AS booking_id,
  n.is_read,
  n.created_at
FROM notifications n
WHERE n.type = 'booking_reminder'
  AND DATE(n.created_at) = CURDATE()
ORDER BY n.created_at DESC;
```

---

## Deployment Guide

### Step 5.1: Pre-Deployment Checklist

- [ ] All tests passing (`npm run test:unit`)
- [ ] Database indexes created (if applicable)
- [ ] Environment variables configured (TZ, SMTP if email enabled)
- [ ] `node-cron` added to `package.json`
- [ ] Scheduler integrated into server startup
- [ ] Graceful shutdown handlers added
- [ ] Logging statements reviewed (no sensitive data)
- [ ] Timezone configured correctly

### Step 5.2: Environment Configuration

**`.env` file:**

```bash
# Scheduler Configuration
TZ=Asia/Kuala_Lumpur
NODE_ENV=production

# Database Configuration (existing)
DB_HOST=your-db-host
DB_USER=your-db-user
DB_PASS=your-db-pass
DB_NAME=rural_tourism

# Email Configuration (optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
EMAIL_FROM=noreply@ruraltourismsabah.com
```

**Timezone Options:**

- `Asia/Kuala_Lumpur` (Malaysia - GMT+8)
- `UTC` (Universal Time)
- `Asia/Singapore` (GMT+8)
- Full list: https://en.wikipedia.org/wiki/List_of_tz_database_time_zones

### Step 5.3: Deployment Steps

**1. Install Dependencies:**

```bash
npm install
```

**2. Run Database Migrations (if indexes added):**

```bash
npx sequelize-cli db:migrate
```

**3. Test Scheduler Manually:**

```bash
# Set environment to development temporarily
NODE_ENV=development npm start

# In another terminal, trigger manually
node -e "require('./scripts/bookingReminderScheduler').triggerNow()"
```

**4. Verify Logs:**

```
[BookingReminderScheduler] ✅ Booking reminder scheduler started (runs daily at 00:00)
[BookingReminderScheduler] Timezone: Asia/Kuala_Lumpur
```

**5. Deploy to Production:**

```bash
# Build (if applicable)
npm run build

# Restart server with PM2 (if using)
pm2 restart rural-tourism-backend

# Or systemd
sudo systemctl restart rural-tourism-backend
```

**6. Monitor First Execution:**

```bash
# View logs in real-time
tail -f /var/log/rural-tourism/app.log

# Or with PM2
pm2 logs rural-tourism-backend
```

### Step 5.4: Monitoring & Alerts

**Daily Health Check:**

Create monitoring script: `scripts/checkSchedulerHealth.js`

```javascript
const Notification = require("../models/notificationModel");
const moment = require("moment");

async function checkSchedulerHealth() {
  const today = moment().format("YYYY-MM-DD");

  const count = await Notification.count({
    where: {
      type: "booking_reminder",
      created_at: {
        [Op.gte]: `${today} 00:00:00`,
        [Op.lt]: `${today} 23:59:59`,
      },
    },
  });

  console.log(`Notifications sent today: ${count}`);

  if (count === 0) {
    console.warn(
      "⚠️ WARNING: No booking reminders sent today! Scheduler may not be running.",
    );
    // Send alert to monitoring service
  } else {
    console.log("✅ Scheduler is healthy");
  }
}

checkSchedulerHealth().then(() => process.exit(0));
```

**Run daily via cron (separate from app):**

```bash
# Add to system crontab
0 1 * * * cd /path/to/app && node scripts/checkSchedulerHealth.js >> /var/log/scheduler-health.log 2>&1
```

---

## Troubleshooting

### Issue 1: Scheduler Not Running

**Symptoms:**

- No logs showing scheduler started
- No notifications created

**Diagnosis:**

```bash
# Check if server started successfully
ps aux | grep node

# Check logs for errors
tail -100 /var/log/rural-tourism/app.log | grep -i scheduler

# Verify node-cron installed
npm list node-cron
```

**Solutions:**

1. Verify `bookingReminderScheduler.start()` is called in `server.js`
2. Check `NODE_ENV !== 'test'` condition
3. Ensure database connection succeeds before scheduler starts

---

### Issue 2: No Notifications Created Despite Bookings Existing

**Symptoms:**

- Scheduler runs successfully
- Bookings exist 3 days out
- No notifications in database

**Diagnosis:**

```sql
-- Check if bookings exist 3 days ahead (activity bookings)
SELECT * FROM bookings
WHERE date = DATE_ADD(CURDATE(), INTERVAL 3 DAY)
  AND status NOT IN ('cancelled', 'rejected');

-- Check if bookings exist 3 days ahead (accommodation bookings)
SELECT * FROM bookings
WHERE check_in_date = DATE_ADD(CURDATE(), INTERVAL 3 DAY)
  AND status NOT IN ('cancelled', 'rejected');

-- Check if user_id (operator) is populated
SELECT
  UniqueID,
  tourist_full_name,
  product_name,
  date,
  check_in_date,
  user_id,
  status
FROM bookings
WHERE (date = DATE_ADD(CURDATE(), INTERVAL 3 DAY)
   OR check_in_date = DATE_ADD(CURDATE(), INTERVAL 3 DAY))
  AND status NOT IN ('cancelled', 'rejected');
```

**Solutions:**

1. Verify booking has valid `user_id` (operator ID)
2. Check that `user_id` exists in `users` table
3. Review service logs for "Skipping" warnings
4. Verify Booking model associations are defined correctly
5. Ensure date format is correct (YYYY-MM-DD)

---

### Issue 3: Duplicate Notifications

**Symptoms:**

- Same operator receives multiple notifications for same booking

**Diagnosis:**

```sql
-- Check for duplicates
SELECT
  user_id,
  related_id,
  COUNT(*) as count
FROM notifications
WHERE type = 'booking_reminder'
  AND DATE(created_at) = CURDATE()
GROUP BY user_id, related_id
HAVING count > 1;
```

**Solutions:**

1. Add unique constraint on `(type, related_id, DATE(created_at))`
2. Verify scheduler not running multiple times (check `isRunning` flag)
3. Review deduplication logic in service

**SQL Fix:**

```sql
CREATE UNIQUE INDEX idx_notifications_unique_reminder
ON notifications(type, related_id, created_at);
```

---

### Issue 4: Timezone Issues

**Symptoms:**

- Notifications sent for wrong date
- Notifications sent at wrong time

**Diagnosis:**

```bash
# Check server timezone
date
timedatectl

# Check Node.js timezone
node -e "console.log(new Date())"
node -e "console.log(process.env.TZ)"
```

**Solutions:**

1. Set `TZ` environment variable in `.env`
2. Restart server after changing timezone
3. Use explicit timezone in cron schedule:
   ```javascript
   cron.schedule("0 0 * * *", task, {
     timezone: "Asia/Kuala_Lumpur",
   });
   ```

---

### Issue 5: High Memory Usage

**Symptoms:**

- Server memory increases after scheduler runs
- Slow query performance

**Diagnosis:**

```bash
# Monitor memory
top -p $(pgrep -f "node.*server.js")

# Check query performance in MySQL:
EXPLAIN SELECT * FROM bookings
WHERE (date = '2026-05-10' OR check_in_date = '2026-05-10')
  AND status NOT IN ('cancelled', 'rejected');

# Check if indexes are being used
SHOW INDEX FROM bookings;
```

**Solutions:**

1. Add database indexes (Step 2.2)
2. Verify indexes are created:
   ```sql
   SHOW INDEX FROM bookings WHERE Key_name LIKE 'idx_bookings%';
   ```
3. Implement batch processing:
   ```javascript
   // Process bookings in chunks of 100
   for (let i = 0; i < bookings.length; i += 100) {
     const chunk = bookings.slice(i, i + 100);
     await processChunk(chunk);
   }
   ```
4. Use `Notification.bulkCreate()` instead of individual creates
5. Add query limits and pagination if dealing with >1000 bookings/day

---

## Appendix

### A. Configuration Reference

**Environment Variables:**

| Variable    | Required | Default         | Description                     |
| ----------- | -------- | --------------- | ------------------------------- |
| `TZ`        | No       | System timezone | Server timezone for cron job    |
| `NODE_ENV`  | No       | `development`   | Skip scheduler if `test`        |
| `SMTP_HOST` | No       | -               | Email server (if email enabled) |
| `SMTP_PORT` | No       | `587`           | Email port                      |
| `SMTP_USER` | No       | -               | Email username                  |
| `SMTP_PASS` | No       | -               | Email password                  |

### B. Cron Pattern Reference

```
┌────────────── Second (optional, 0-59)
│ ┌──────────── Minute (0-59)
│ │ ┌────────── Hour (0-23)
│ │ │ ┌──────── Day of month (1-31)
│ │ │ │ ┌────── Month (1-12)
│ │ │ │ │ ┌──── Day of week (0-7, 0/7 = Sunday)
│ │ │ │ │ │
│ │ │ │ │ │
* * * * * *
```

**Common Patterns:**

- `0 0 * * *` - Daily at midnight
- `0 9 * * *` - Daily at 9 AM
- `0 */6 * * *` - Every 6 hours
- `0 0 * * 1` - Every Monday at midnight
- `*/30 * * * *` - Every 30 minutes
- `0 0 1 * *` - First day of month at midnight

### C. Useful SQL Queries

**Count reminders sent today:**

```sql
SELECT COUNT(*) as total
FROM notifications
WHERE type = 'booking_reminder'
  AND DATE(created_at) = CURDATE();
```

**View recent reminders:**

```sql
SELECT
  n.id,
  n.user_id,
  u.name as operator_name,
  u.email as operator_email,
  n.message,
  n.is_read,
  n.created_at
FROM notifications n
LEFT JOIN users u ON n.user_id = u.UniqueID
WHERE n.type = 'booking_reminder'
  AND n.user_type = 'operator'
ORDER BY n.created_at DESC
LIMIT 20;
```

**Find operators with unread reminders:**

```sql
SELECT
  user_id,
  COUNT(*) as unread_count
FROM notifications
WHERE type = 'booking_reminder'
  AND is_read = 0
GROUP BY user_id
ORDER BY unread_count DESC;
```

---

## Summary

This documentation covers the complete backend implementation of the booking reminder notification system. Key deliverables:

1. ✅ Scheduler infrastructure using `node-cron`
2. ✅ NotificationService with comprehensive business logic
3. ✅ Database query optimization strategies
4. ✅ Unit and integration tests
5. ✅ Deployment guide and monitoring
6. ✅ Troubleshooting reference

**Next Steps:**

- Review and approve this implementation
- Proceed with frontend implementation (see BOOKING_REMINDER_NOTIFICATION_FRONTEND.md)
- Schedule code review
- Plan deployment timeline

**Estimated Implementation Time:** 8-12 hours (including testing)

---

_Last Updated: May 7, 2026_

---

## Update — May 18, 2026: Notification UX & Bell Badge Fixes

### `markAsRead` — Made Idempotent

`controllers/notificationController.js` previously returned `404` when a notification was already read (`is_read = 1`). This caused a red error toast on the frontend whenever the panel called `markAsRead` on a notification that had already been marked read by `markAllAsRead`.

**Fix:** Return `200` instead of `404` when the notification is already read.

```js
// Before
if (notification.is_read) {
  return res.status(404).json({ message: 'Notification not found or already read.' });
}

// After — idempotent, no error toast on the frontend
if (notification.is_read) {
  return res.json({ message: 'Notification already read.' });
}
```

### `dashboard:read` Permission — `operator_admin` Only

Migration `migrations/20260518120000-add-dashboard-permission-to-operator.js` added the `dashboard:read` permission and assigned it exclusively to the `operator_admin` role. `operator_staff` does not receive this permission.

The Dashboard menu item in `menu.service.ts` is gated by `permission: 'dashboard:read'`, so it only appears for `operator_admin` users. After running the migration, operators must **log out and back in** to receive the updated JWT with the new permission.
