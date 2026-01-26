# Booking-Aware Filtering - Visual Guide

## 📊 System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (Ionic/Angular)              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  User selects date: January 12, 2025                 │   │
│  │  Sends: GET /api/activity?date=2025-01-12            │   │
│  └───────────────────────┬──────────────────────────────┘   │
└────────────────────────┬─┴──────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    Backend (Node.js/Express)                 │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Routes Layer (activityRoutes.js)                    │   │
│  │  • Receives request with date parameter              │   │
│  │  • Calls controller with date filter                 │   │
│  └───────────────────────┬──────────────────────────────┘   │
│                          │                                   │
│                          ▼                                   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Controller Layer (operatorActivitiesController.js)  │   │
│  │  • Fetches all operator activities                   │   │
│  │  • For each activity:                                │   │
│  │    1. Get booked dates from activity_booking         │   │
│  │    2. Filter out booked dates                        │   │
│  │    3. Check if matches date filter                   │   │
│  └───────────────────────┬──────────────────────────────┘   │
│                          │                                   │
│                          ▼                                   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Model Layer (Sequelize)                             │   │
│  │  • OperatorActivity.findAll()                        │   │
│  │  • ActivityBooking.findAll(where: operator_id)       │   │
│  └───────────────────────┬──────────────────────────────┘   │
└────────────────────────┬─┴──────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                      Database (MySQL)                        │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  operator_activities                                 │   │
│  │  ┌────────────────────────────────────────────────┐  │   │
│  │  │ id: act_123                                    │  │   │
│  │  │ available_dates: [11, 12, 13, 14 January]      │  │   │
│  │  └────────────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────┘   │
│                          │                                   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  activity_booking                                    │   │
│  │  ┌────────────────────────────────────────────────┐  │   │
│  │  │ operator_activity_id: act_123                  │  │   │
│  │  │ date: 2025-01-12                               │  │   │
│  │  │ status: confirmed                              │  │   │
│  │  └────────────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    Processing & Filtering                    │
│                                                              │
│  Step 1: Fetch Activity Data                                │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Original available_dates: [11, 12, 13, 14 Jan]       │   │
│  └──────────────────────────────────────────────────────┘   │
│                          │                                   │
│                          ▼                                   │
│  Step 2: Fetch Bookings                                     │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Booked dates: [12 Jan]                               │   │
│  │ (Only confirmed/completed status block dates)        │   │
│  └──────────────────────────────────────────────────────┘   │
│                          │                                   │
│                          ▼                                   │
│  Step 3: Filter Available Dates                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ filtered_dates = [11, 12, 13, 14] - [12]             │   │
│  │ Result: [11, 13, 14 Jan]                             │   │
│  └──────────────────────────────────────────────────────┘   │
│                          │                                   │
│                          ▼                                   │
│  Step 4: Apply Date Filter                                  │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ User wants: 2025-01-12                               │   │
│  │ Available: [11, 13, 14]                              │   │
│  │ Match: NO ❌                                          │   │
│  │ Action: Exclude this activity                        │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                      Response to Frontend                    │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  []  // Empty array - no activities match            │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔄 Data Flow Examples

### Example 1: Filtering with Booked Date

```
┌────────────────────────────────────────────────────────┐
│ Database State                                         │
├────────────────────────────────────────────────────────┤
│ operator_activities:                                   │
│   - id: "act_123"                                      │
│   - activity_name: "Rafting"                           │
│   - available_dates: [                                 │
│       "2025-01-11",                                    │
│       "2025-01-12", ◄── This date is booked!           │
│       "2025-01-13",                                    │
│       "2025-01-14"                                     │
│     ]                                                  │
│                                                        │
│ activity_booking:                                      │
│   - operator_activity_id: "act_123"                    │
│   - date: "2025-01-12"                                 │
│   - status: "confirmed"                                │
└────────────────────────────────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────┐
│ User Request                                           │
├────────────────────────────────────────────────────────┤
│ GET /api/activity?date=2025-01-12                      │
└────────────────────────────────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────┐
│ Backend Processing                                     │
├────────────────────────────────────────────────────────┤
│ 1. Fetch activities                                    │
│    ✓ Found: act_123                                    │
│                                                        │
│ 2. Get booked dates for act_123                        │
│    ✓ Found: ["2025-01-12"]                             │
│                                                        │
│ 3. Filter available dates                              │
│    Original: [11, 12, 13, 14]                          │
│    Booked: [12]                                        │
│    Filtered: [11, 13, 14] ◄── 12 removed!              │
│                                                        │
│ 4. Check date filter match                             │
│    User wants: 2025-01-12                              │
│    Available: [11, 13, 14]                             │
│    Match: NO ❌                                         │
│    Decision: Exclude activity                          │
└────────────────────────────────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────┐
│ Response                                               │
├────────────────────────────────────────────────────────┤
│ []  // No activities available on 2025-01-12           │
└────────────────────────────────────────────────────────┘
```

### Example 2: Filtering with Available Date

```
┌────────────────────────────────────────────────────────┐
│ User Request                                           │
├────────────────────────────────────────────────────────┤
│ GET /api/activity?date=2025-01-13                      │
└────────────────────────────────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────┐
│ Backend Processing                                     │
├────────────────────────────────────────────────────────┤
│ 1. Fetch activities                                    │
│    ✓ Found: act_123                                    │
│                                                        │
│ 2. Get booked dates for act_123                        │
│    ✓ Found: ["2025-01-12"]                             │
│                                                        │
│ 3. Filter available dates                              │
│    Original: [11, 12, 13, 14]                          │
│    Booked: [12]                                        │
│    Filtered: [11, 13, 14]                              │
│                                                        │
│ 4. Check date filter match                             │
│    User wants: 2025-01-13                              │
│    Available: [11, 13, 14]                             │
│    Match: YES ✅                                        │
│    Decision: Include activity                          │
└────────────────────────────────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────┐
│ Response                                               │
├────────────────────────────────────────────────────────┤
│ [                                                      │
│   {                                                    │
│     "id": "act_123",                                   │
│     "activity_name": "Rafting",                        │
│     "available_dates": [                               │
│       "2025-01-11",                                    │
│       "2025-01-13",  ◄── User's date is here!          │
│       "2025-01-14"                                     │
│     ]                                                  │
│   }                                                    │
│ ]                                                      │
└────────────────────────────────────────────────────────┘
```

### Example 3: Date Range Filter

```
┌────────────────────────────────────────────────────────┐
│ User Request                                           │
├────────────────────────────────────────────────────────┤
│ GET /api/activity?startDate=2025-01-11                 │
│                  &endDate=2025-01-14                   │
└────────────────────────────────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────┐
│ Backend Processing                                     │
├────────────────────────────────────────────────────────┤
│ 1. Filter available dates                              │
│    Original: [11, 12, 13, 14]                          │
│    Booked: [12]                                        │
│    Filtered: [11, 13, 14]                              │
│                                                        │
│ 2. Check if ANY date falls in range                    │
│    Range: 2025-01-11 to 2025-01-14                     │
│    Available: [11, 13, 14]                             │
│    Match:                                              │
│      11 is in range? ✅ YES                             │
│      13 is in range? ✅ YES                             │
│      14 is in range? ✅ YES                             │
│    Decision: Include activity                          │
└────────────────────────────────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────┐
│ Response                                               │
├────────────────────────────────────────────────────────┤
│ [                                                      │
│   {                                                    │
│     "id": "act_123",                                   │
│     "activity_name": "Rafting",                        │
│     "available_dates": [                               │
│       "2025-01-11", ◄── In range                       │
│       "2025-01-13", ◄── In range (12 excluded!)        │
│       "2025-01-14"  ◄── In range                       │
│     ]                                                  │
│   }                                                    │
│ ]                                                      │
└────────────────────────────────────────────────────────┘
```

---

## 🧩 Code Flow Diagram

```
activityRoutes.js
    │
    ├─► GET /api/activity?date=X
    │
    └─► async handler
         │
         ├─► 1. Parse query params (date, startDate, endDate)
         │
         ├─► 2. OperatorActivity.findAll()
         │    └─► Fetch all activities from database
         │
         ├─► 3. For each activity (Promise.all):
         │    │
         │    ├─► getBookedDatesForActivity(activity.id)
         │    │    │
         │    │    ├─► ActivityBooking.findAll({
         │    │    │     where: {
         │    │    │       operator_activity_id,
         │    │    │       status: { [Op.in]: ['confirmed', 'completed'] }
         │    │    │     }
         │    │    │   })
         │    │    │
         │    │    └─► Return: ['2025-01-12', '2025-01-15', ...]
         │    │
         │    ├─► filterAvailableDates(available, booked)
         │    │    │
         │    │    ├─► Normalize all dates to YYYY-MM-DD
         │    │    ├─► Create Set of booked dates
         │    │    └─► Filter: keep only non-booked dates
         │    │    └─► Return: ['2025-01-11', '2025-01-13', ...]
         │    │
         │    ├─► matchesDateFilter(filtered, start, end)
         │    │    │
         │    │    ├─► If no filter: return true
         │    │    ├─► If filter: check if any date in range
         │    │    └─► Return: true/false
         │    │
         │    └─► Return activity object or null
         │
         ├─► 4. Filter out null entries
         │
         └─► 5. res.json(filteredActivities)
```

---

## 📊 Database Query Pattern

```sql
-- Step 1: Get operator activities
SELECT * FROM operator_activities
WHERE ... (conditions);

-- Step 2: For each activity, get bookings
SELECT date FROM activity_booking
WHERE operator_activity_id = 'act_123'
  AND status != 'cancelled';

-- Step 3: Filter logic (done in JavaScript)
-- Original: [11, 12, 13, 14 Jan]
-- Booked:   [12 Jan]
-- Result:   [11, 13, 14 Jan]

-- Step 4: Check date filter (done in JavaScript)
-- User filter: 12 Jan
-- Available:   [11, 13, 14 Jan]
-- Match:       NO → Exclude activity
```

---

## 🎯 Decision Tree

```
User makes request
    │
    ├─► Has date filter?
    │   │
    │   ├─► YES
    │   │   │
    │   │   └─► For each activity:
    │   │       │
    │   │       ├─► Get booked dates
    │   │       ├─► Filter available dates
    │   │       ├─► Check if filter date is available
    │   │       │   │
    │   │       │   ├─► YES → Include activity
    │   │       │   └─► NO  → Exclude activity
    │   │       │
    │   │       └─► Return filtered list
    │   │
    │   └─► NO
    │       │
    │       └─► For each activity:
    │           │
    │           ├─► Get booked dates
    │           ├─► Filter available dates
    │           └─► Return all activities
    │               (with filtered dates)
    │
    └─► Send response
```

---

## 💡 Key Insights

### Why This Approach Works

1. **Always Filters** - Even without date filter, booked dates are removed
2. **Accurate** - Uses real-time booking data from database
3. **Performant** - Parallel processing with Promise.all()
4. **Safe** - Only confirmed and completed bookings block dates
5. **Flexible** - Supports single date or range filtering

### What Makes It Special

```
❌ Traditional Approach:
   Frontend filters based on static available_dates
   → Can show booked dates
   → Allows double bookings

✅ Our Approach:
   Backend dynamically filters based on actual bookings
   → Always shows accurate availability
   → Prevents double bookings automatically
```

---

See complete documentation in [BOOKING_AWARE_FILTERING.md](./BOOKING_AWARE_FILTERING.md)
