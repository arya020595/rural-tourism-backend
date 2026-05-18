# Booking Reminder Notification System - Implementation Guide

**Quick Reference & Overview**  
**Date:** May 7, 2026  
**Feature:** Automated 3-Day Advance Booking Notifications for Operators

---

## 📋 Quick Summary

This feature automatically notifies operators 3 days before their customers' bookings via:

- **Backend**: Daily cron job at midnight scanning upcoming bookings
- **Frontend**: Real-time polling (every 60 seconds) updating bell icon badge
- **Delivery**: In-app notifications only (database records)
- **Target**: Operators managing activity, accommodation, and package bookings

---

## 📁 Documentation Structure

### **Backend Documentation**

📄 **File**: `rural-tourism-backend/docs/BOOKING_REMINDER_NOTIFICATION_BACKEND.md`

**Covers:**

- ✅ Phase 1: Infrastructure Setup (node-cron, scheduler, service)
- ✅ Phase 2: Database Query Logic (3 booking types)
- ✅ Phase 3: Notification Creation (message templates, deduplication)
- ✅ Phase 4: Testing & Validation (unit tests, integration tests)
- ✅ Deployment Guide (environment setup, monitoring)
- ✅ Troubleshooting (common issues and solutions)

**Key Files to Create:**

```
services/notificationService.js
scripts/bookingReminderScheduler.js
constants/notificationTypes.js
tests/unit/notificationService.test.js
```

**Key Files to Modify:**

```
server.js (or bin/www) - Initialize scheduler
package.json - Add node-cron dependency
```

---

### **Frontend Documentation**

📄 **File**: `rural-tourism-frontend/docs/BOOKING_REMINDER_NOTIFICATION_FRONTEND.md`

**Covers:**

- ✅ Phase 1: Notification Polling Setup (RxJS, reactive state)
- ✅ Phase 2: UI Enhancements (filtering, icons, styling)
- ✅ Phase 3: Testing & Validation (unit tests, E2E tests)
- ✅ Deployment Guide (build configuration, production setup)
- ✅ Troubleshooting (CORS, memory leaks, performance)

**Key Files to Modify:**

```
src/app/services/notification.service.ts
src/app/app.component.ts
src/app/services/auth.service.ts
src/app/home/home.page.ts
src/app/notifications/notifications.page.ts
src/app/notifications/notifications.page.html
src/app/notifications/notifications.page.scss
```

**Optional Enhancements:**

```
@capacitor/haptics - Vibration feedback
Type-based filtering - Segment buttons
Deep linking - Navigate to booking details
```

---

## 🚀 Implementation Sequence

### **Step 1: Backend Setup** (Priority: HIGH)

```bash
# 1. Install dependencies
cd rural-tourism-backend
npm install node-cron --save

# 2. Create required files (in order)
touch constants/notificationTypes.js
touch services/notificationService.js
touch scripts/bookingReminderScheduler.js
touch tests/unit/notificationService.test.js

# 3. Implement code (refer to backend docs for full code)

# 4. Integrate scheduler into server.js

# 5. Test manually
node scripts/console.js
# > const service = require('./services/notificationService');
# > await service.sendBookingReminders(3);

# 6. Run unit tests
npm run test:unit -- notificationService.test.js

# 7. Start server and verify scheduler
npm start
# Look for: "✅ Booking reminder scheduler started"
```

**Estimated Time**: 6-8 hours

---

### **Step 2: Frontend Setup** (Priority: HIGH)

```bash
# 1. Navigate to frontend
cd rural-tourism-frontend

# 2. Modify NotificationService
# Edit: src/app/services/notification.service.ts
# Add: polling logic with RxJS interval()

# 3. Update AppComponent or AuthService
# Edit: src/app/app.component.ts
# Add: Start polling after login

# 4. Update all pages with bell icons
# Edit: src/app/home/home.page.ts (and others)
# Change: Manual load → Subscribe to unreadCount$

# 5. Enhance notifications page
# Edit: src/app/notifications/notifications.page.ts
# Add: Pull-to-refresh, deep linking, filtering

# 6. Test in browser
ionic serve
# Login and watch console for polling logs

# 7. Run unit tests
npm test -- --include='**/notification.service.spec.ts'
```

**Estimated Time**: 4-6 hours

---

### **Step 3: Integration Testing** (Priority: MEDIUM)

```bash
# 1. Ensure both backend and frontend running
cd rural-tourism-backend && npm start &
cd rural-tourism-frontend && ionic serve &

# 2. Create test booking 3 days in future
# Use SQL or API to insert test data

# 3. Manually trigger scheduler
node -e "require('./scripts/bookingReminderScheduler').triggerNow()"

# 4. Verify notification created in database
# SELECT * FROM notifications WHERE type = 'booking_reminder';

# 5. Login to frontend as operator
# Watch bell icon badge update within 60 seconds

# 6. Run E2E tests
npm run e2e -- notification-reminder.test.js
```

**Estimated Time**: 2-3 hours

---

### **Step 4: Deployment** (Priority: LOW - After Testing)

**Backend Deployment:**

```bash
# 1. Set environment variables
# .env:
TZ=Asia/Kuala_Lumpur
NODE_ENV=production

# 2. Run migrations (if indexes added)
npx sequelize-cli db:migrate

# 3. Deploy to production server
# (PM2, Docker, systemd, etc.)

# 4. Monitor logs for first execution
tail -f /var/log/rural-tourism/app.log | grep "BookingReminderScheduler"
```

**Frontend Deployment:**

```bash
# 1. Update production environment
# Edit: src/environments/environment.prod.ts
# Set: apiUrl to production backend

# 2. Build for web
ionic build --prod

# 3. Build for Android
npm run android:release

# 4. Deploy web build to hosting
# (Nginx, Apache, Firebase Hosting, etc.)

# 5. Upload APK to Google Play Console
```

**Estimated Time**: 2-4 hours

---

## 📊 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         DAILY AT 00:00                          │
│                                                                 │
│  ┌──────────────────────────────────────────────────────┐      │
│  │  Backend Cron Job (node-cron)                        │      │
│  │  scripts/bookingReminderScheduler.js                 │      │
│  └───────────────────┬──────────────────────────────────┘      │
│                      │                                          │
│                      ▼                                          │
│  ┌──────────────────────────────────────────────────────┐      │
│  │  NotificationService.sendBookingReminders()          │      │
│  │  - Query UNIFIED bookings table                      │      │
│  │  - WHERE date = target OR check_in_date = target     │      │
│  │  - Filter bookings 3 days ahead                      │      │
│  │  - Create notification records in DB                 │      │
│  └───────────────────┬──────────────────────────────────┘      │
│                      │                                          │
│                      ▼                                          │
│  ┌──────────────────────────────────────────────────────┐      │
│  │  Database (notifications table)                      │      │
│  │  - user_id, user_type: 'operator'                    │      │
│  │  - type: 'booking_reminder'                          │      │
│  │  - is_read: 0                                        │      │
│  └──────────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────────┘
                      │
                      │ API: GET /notifications/operator/:id/unread-count
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                      FRONTEND (Every 60s)                       │
│                                                                 │
│  ┌──────────────────────────────────────────────────────┐      │
│  │  NotificationService.startPolling()                  │      │
│  │  - RxJS interval(60000)                              │      │
│  │  - HTTP GET unread count                             │      │
│  │  - Update BehaviorSubject                            │      │
│  └───────────────────┬──────────────────────────────────┘      │
│                      │                                          │
│                      ▼                                          │
│  ┌──────────────────────────────────────────────────────┐      │
│  │  All Components Subscribe to unreadCount$            │      │
│  │  - home.page.ts                                      │      │
│  │  - notifications.page.ts                             │      │
│  │  - e-receipt.page.ts                                 │      │
│  └───────────────────┬──────────────────────────────────┘      │
│                      │                                          │
│                      ▼                                          │
│  ┌──────────────────────────────────────────────────────┐      │
│  │  Bell Icon Badge Updates Automatically               │      │
│  │  <ion-badge>{{ unreadCount }}</ion-badge>           │      │
│  └──────────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔑 Key Design Decisions

### **1. Scheduler: node-cron vs. Alternatives**

**Chosen**: `node-cron`

**Rationale**:

- ✅ Simple, lightweight (zero dependencies)
- ✅ Reliable for daily jobs
- ✅ Built-in timezone support
- ✅ No external infrastructure required

**Alternatives Considered**:

- ❌ `bull` - Requires Redis (overkill for daily job)
- ❌ `agenda` - Requires MongoDB (different DB)
- ❌ System cron - Requires shell scripts, less portable

---

### **2. Polling Interval: 60 seconds**

**Rationale**:

- ✅ Balance between real-time feel and server load
- ✅ Notifications not time-critical (3-day advance)
- ✅ Acceptable battery drain on mobile
- ✅ Aligns with industry standards (Gmail polls every 60s)

**Alternatives Considered**:

- ❌ 30 seconds - Higher load, minimal UX benefit
- ❌ WebSocket - More complex, overkill for low-frequency updates
- ❌ Push notifications - Requires Firebase setup (future enhancement)

---

### **3. Notification Message Format**

**Chosen**: `"${touristName} has a ${bookingType} booking in 3 days on ${date}"`

**Example**: "John Doe has a activity booking in 3 days on May 10, 2026 (Jungle Trekking)"

**Rationale**:

- ✅ Clear and actionable
- ✅ Includes all critical info (who, what, when)
- ✅ Friendly, conversational tone
- ✅ Scalable to multiple booking types

---

### **4. Target Users: Operators Only**

**Rationale**:

- ✅ Operators manage bookings and need advance preparation
- ✅ Tourists already have booking confirmations (different flow)
- ✅ Simplifies implementation (one user type)
- ✅ Can expand to tourists later if needed

---

## ⚠️ Important Considerations

### **Timezone Handling**

**Issue**: Server timezone must match business timezone.

**Solution**:

```bash
# .env
TZ=Asia/Kuala_Lumpur
```

**Verification**:

```bash
# On server
date
# Should show: +08 (Malaysia time)
```

---

### **Deduplication**

**Issue**: Same booking might trigger multiple notifications if scheduler runs twice.

**Solution 1** (Implemented): In-memory Map deduplication

```javascript
const operatorNotifications = new Map();
const key = `${operatorId}-${bookingId}`;
if (!operatorNotifications.has(key)) {
  // Create notification
}
```

**Solution 2** (Recommended for Production): Database unique constraint

```sql
CREATE UNIQUE INDEX idx_notifications_unique_reminder
ON notifications(type, related_id, DATE(created_at))
WHERE type = 'booking_reminder';
```

---

### **Performance Optimization**

**For High Volume (>1000 bookings/day)**:

1. **Add Database Indexes**:

   ```sql
   CREATE INDEX idx_booking_activities_date_status
   ON booking_activities(date, status);
   ```

2. **Batch Notification Creation**:

   ```javascript
   await Notification.bulkCreate(notificationPayloads);
   ```

3. **Process in Chunks**:
   ```javascript
   for (let i = 0; i < bookings.length; i += 100) {
     const chunk = bookings.slice(i, i + 100);
     await processChunk(chunk);
   }
   ```

---

## 📈 Success Metrics

**Backend Metrics:**

- ✅ Scheduler executes daily without errors
- ✅ Notifications created = Bookings 3 days out (minus cancelled)
- ✅ Zero duplicate notifications for same booking
- ✅ Query execution time < 5 seconds

**Frontend Metrics:**

- ✅ Polling starts automatically after login
- ✅ Badge updates within 60 seconds of notification creation
- ✅ Zero memory leaks (stable memory usage over 1 hour)
- ✅ Click-to-booking navigation works 100% of time

**User Experience:**

- ✅ Operators see reminders 3 days before booking
- ✅ Notifications include all relevant info (tourist, date, type)
- ✅ Badge count matches actual unread notifications
- ✅ Marking as read decrements count immediately

---

## 🧪 Testing Checklist

### **Backend Tests**

- [ ] Unit tests for `NotificationService` (6 test cases)
- [ ] Integration test (create booking → trigger scheduler → verify notification)
- [ ] Manual REPL test (`node scripts/console.js`)
- [ ] Scheduler health check (verify daily execution)

### **Frontend Tests**

- [ ] Unit tests for `NotificationService` (6 test cases)
- [ ] E2E test (login → verify badge → click notification → navigate)
- [ ] Manual browser test (all pages with bell icons)
- [ ] Mobile app test (Android APK)

### **Integration Tests**

- [ ] End-to-end flow (booking creation → scheduler → frontend polling)
- [ ] Load test (1000 bookings, measure performance)
- [ ] Timezone test (verify notifications sent at correct time)
- [ ] Error resilience test (backend down, verify frontend continues)

---

## 📞 Support & Troubleshooting

### **Common Issues**

| Issue                    | Documentation Section                     |
| ------------------------ | ----------------------------------------- |
| Scheduler not running    | Backend Docs → Troubleshooting → Issue 1  |
| No notifications created | Backend Docs → Troubleshooting → Issue 2  |
| Duplicate notifications  | Backend Docs → Troubleshooting → Issue 3  |
| Badge not updating       | Frontend Docs → Troubleshooting → Issue 1 |
| Polling not starting     | Frontend Docs → Troubleshooting → Issue 2 |
| Memory leaks             | Frontend Docs → Troubleshooting → Issue 3 |
| CORS errors              | Frontend Docs → Troubleshooting → Issue 4 |
| High server load         | Frontend Docs → Troubleshooting → Issue 5 |

---

## 🔄 Future Enhancements

### **Phase 2: Push Notifications (Mobile)**

- Install Firebase Cloud Messaging (FCM)
- Add `@capacitor/push-notifications` plugin
- Register device tokens on login
- Send push notifications in addition to in-app

**Estimated Effort**: 8-12 hours

---

### **Phase 3: Email Notifications**

- Extend `emailService.js` with booking reminder template
- Add operator email preference (opt-in/opt-out)
- Send email alongside in-app notification

**Estimated Effort**: 4-6 hours

---

### **Phase 4: Customizable Reminder Timing**

- Add `operator_preferences` table
- Allow operators to choose: 1, 3, 5, or 7 days advance
- Update scheduler to respect per-operator preferences

**Estimated Effort**: 6-8 hours

---

### **Phase 5: WebSocket Real-Time Updates**

- Replace polling with Socket.io
- Push notifications immediately when created
- Reduce server load (no periodic polling)

**Estimated Effort**: 12-16 hours

---

## 📚 Related Documentation

- **Backend Conventions**: `rural-tourism-backend/AGENTS.md`, `rural-tourism-backend/CLAUDE.md`
- **Frontend Workflow**: `rural-tourism-frontend/docs/IONIC_WORKFLOW_DOCUMENTATION.md`
- **Existing Features**:
  - `rural-tourism-frontend/docs/SEARCH_FILTER_IMPLEMENTATION.md`
  - `rural-tourism-frontend/docs/COMPANY_PROFILE_LOGO_CROP_UPDATE_2026-04-15.md`

---

## 📝 Change Log

| Date        | Version | Changes                         |
| ----------- | ------- | ------------------------------- |
| May 7, 2026 | 1.0     | Initial documentation created   |
|             |         | - Backend implementation guide  |
|             |         | - Frontend implementation guide |
|             |         | - Quick reference guide         |

---

## ✅ Pre-Implementation Checklist

Before starting implementation, ensure:

- [ ] Read both backend and frontend documentation fully
- [ ] Backend server running locally
- [ ] Database accessible and migrations up to date
- [ ] Frontend development server can connect to backend
- [ ] Test operator account exists
- [ ] Test tourist account exists (for creating bookings)
- [ ] Basic understanding of RxJS observables
- [ ] Basic understanding of node-cron patterns
- [ ] Git branch created for this feature
- [ ] Estimated timeline communicated to team

---

## 🎯 Implementation Timeline

| Phase                                      | Duration        | Dependencies     |
| ------------------------------------------ | --------------- | ---------------- |
| **Backend Phase 1**: Infrastructure        | 3-4 hours       | None             |
| **Backend Phase 2**: Query Logic           | 2-3 hours       | Phase 1          |
| **Backend Phase 3**: Notification Creation | 1-2 hours       | Phase 2          |
| **Backend Phase 4**: Testing               | 2-3 hours       | Phase 3          |
| **Frontend Phase 1**: Polling Setup        | 2-3 hours       | Backend Phase 3  |
| **Frontend Phase 2**: UI Enhancements      | 2-3 hours       | Frontend Phase 1 |
| **Frontend Phase 3**: Testing              | 2-3 hours       | Frontend Phase 2 |
| **Integration Testing**                    | 2-3 hours       | All phases       |
| **Deployment**                             | 2-4 hours       | All phases       |
| **Total**                                  | **18-28 hours** |                  |

**Recommended Schedule**: 2-3 days with 1 developer, or 1-2 days with 2 developers (backend + frontend parallel)

---

## 📧 Contact & Feedback

For questions or issues during implementation:

- Check troubleshooting sections in respective docs
- Review code comments and inline documentation
- Consult with senior developer for architectural decisions
- Update this guide with learnings for future reference

---

**Good luck with the implementation! 🚀**

_This documentation is comprehensive and self-contained. Follow each phase sequentially, and you'll have a production-ready notification system._
