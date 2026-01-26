# Booking-Aware Date Filtering Implementation

## Overview

This implementation ensures that booked dates are automatically excluded from activity availability, preventing double-bookings and providing accurate date filtering for tourists.

## Key Features

✅ **Automatic Booking Exclusion** - Dates with confirmed/completed bookings are removed from `available_dates`  
✅ **Smart Date Filtering** - Filter activities by single date or date range  
✅ **No Double Bookings** - Booked dates are hidden from search results  
✅ **Status-Aware Filtering** - Only 'confirmed' and 'completed' bookings block dates

---

## How It Works

### 1. Data Flow

```
┌─────────────────────────┐
│  operator_activities    │
│  available_dates:       │
│  [11, 12, 13, 14 Jan]   │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│  activity_booking       │
│  date: 12 Jan           │
│  operator: Arya         │
│  status: confirmed      │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│  Filtered Result        │
│  available_dates:       │
│  [11, 13, 14 Jan]       │  ◄── 12 Jan excluded!
└─────────────────────────┘
```

### 2. Filter Logic

**Example Scenario:**

- **Operator:** Arya
- **Activity:** Rafting
- **Original available_dates:** `[11, 12, 13, 14 January 2025]`
- **Booking exists:** `12 January 2025`

**Results:**

| User Filter                               | Result                                                   |
| ----------------------------------------- | -------------------------------------------------------- |
| `date=2025-01-12`                         | ❌ No results (date is booked)                           |
| `date=2025-01-11`                         | ✅ Activity shown                                        |
| `date=2025-01-13`                         | ✅ Activity shown                                        |
| `startDate=2025-01-11&endDate=2025-01-14` | ✅ Activity shown (has some available dates in range)    |
| No filter                                 | ✅ Activity shown with filtered dates `[11, 13, 14 Jan]` |

---

## API Usage

### Base Endpoints

All activity-related endpoints now support booking-aware filtering:

1. **`GET /api/activity`** - All operator activities
2. **`GET /api/operator-activities`** - All operator activities
3. **`GET /api/operator-activities/activity/:activity_id`** - Operators for specific activity
4. **`GET /api/operator-activities/:id`** - Single operator activity details
5. **`GET /api/operator-activities/user/:rt_user_id`** - Activities by user

### Query Parameters

| Parameter   | Type         | Description                  | Example                 |
| ----------- | ------------ | ---------------------------- | ----------------------- |
| `date`      | `YYYY-MM-DD` | Filter by single date        | `?date=2025-01-15`      |
| `startDate` | `YYYY-MM-DD` | Filter by date range (start) | `?startDate=2025-01-10` |
| `endDate`   | `YYYY-MM-DD` | Filter by date range (end)   | `?endDate=2025-01-20`   |

### Example Requests

#### 1. Get all activities (no filter)

```bash
GET /api/activity
```

**Response:**

```json
[
  {
    "id": "act_123",
    "activity_name": "Rafting",
    "available_dates": ["2025-01-11", "2025-01-13", "2025-01-14"],
    // 12th excluded because it's booked
    ...
  }
]
```

#### 2. Filter by single date

```bash
GET /api/activity?date=2025-01-13
```

**Response:**

```json
[
  {
    "id": "act_123",
    "activity_name": "Rafting",
    "available_dates": ["2025-01-11", "2025-01-13", "2025-01-14"],
    // Only activities with 13th available (after removing booked dates)
    ...
  }
]
```

#### 3. Filter by date range

```bash
GET /api/activity?startDate=2025-01-10&endDate=2025-01-15
```

**Response:**

```json
[
  {
    "id": "act_123",
    "activity_name": "Rafting",
    "available_dates": ["2025-01-11", "2025-01-13", "2025-01-14"],
    // Activity shown because it has SOME available dates in the range
    ...
  }
]
```

#### 4. Get operators for specific activity with date filter

```bash
GET /api/operator-activities/activity/5?startDate=2025-01-15&endDate=2025-01-20
```

**Response:**

```json
[
  {
    "id": "act_456",
    "business_name": "Arya Adventures",
    "available_dates": ["2025-01-15", "2025-01-17", "2025-01-19"],
    // Only operators with availability in the date range
    ...
  }
]
```

---

## Implementation Details

### Modified Files

1. **`models/operatorActivitiesModel.js`**
   - Added relationship with `ActivityBooking` model
   - Added `hasMany` association for bookings

2. **`controllers/operatorActivitiesController.js`**
   - Added `getBookedDatesForActivity()` helper
   - Added `filterAvailableDates()` helper
   - Added `matchesDateFilter()` helper
   - Updated all controller methods to use booking-aware filtering

3. **`routes/activityRoutes.js`**
   - Added booking-aware filtering helpers
   - Updated GET `/` endpoint with date filtering support
   - Added query parameter support

### Helper Functions

#### `getBookedDatesForActivity(operatorActivityId)`

Fetches all booked dates for a specific operator activity, excluding cancelled bookings.

```javascript
// Returns: ['2025-01-12', '2025-01-15']
const bookedDates = await getBookedDatesForActivity("act_123");
```

#### `filterAvailableDates(availableDates, bookedDates)`

Removes booked dates from the available dates array.

```javascript
const available = ["2025-01-11", "2025-01-12", "2025-01-13"];
const booked = ["2025-01-12"];
const filtered = filterAvailableDates(available, booked);
// Returns: ['2025-01-11', '2025-01-13']
```

#### `matchesDateFilter(actualAvailableDates, startDate, endDate)`

Checks if an activity has any available dates within the filter range.

```javascript
const available = ["2025-01-11", "2025-01-13"];
const matches = matchesDateFilter(available, "2025-01-10", "2025-01-12");
// Returns: true (because 2025-01-11 is in range)
```

---

## Database Schema

### `operator_activities` Table

```sql
available_dates JSON  -- Array of available dates: ["2025-01-11", "2025-01-12"]
```

### `activity_booking` Table

```sql
id                     BIGINT PRIMARY KEY
operator_activity_id   STRING (FK to operator_activities)
date                   DATE
status                 STRING ('confirmed', 'cancelled', 'pending')
```

---

## Testing

### Test Scenarios

1. **No bookings**
   - All dates in `available_dates` should be returned

2. **Single booking**
   - Booked date should be excluded from `available_dates`

3. **Multiple bookings**
   - All booked dates should be excluded

4. **Cancelled booking**
   - Cancelled booking dates should remain available

5. **Date filter - exact match**
   - Activity shown only if filtered date is available after excluding bookings

6. **Date filter - range**
   - Activity shown if ANY date in range is available after excluding bookings

7. **Date filter - no matches**
   - Empty array returned if no activities have availability in range

### Manual Testing

```bash
# 1. Create a booking for 2025-01-12
POST /api/booking-activity
{
  "operator_activity_id": "act_123",
  "date": "2025-01-12",
  "status": "confirmed"
}

# 2. Filter for that date - should return no results
GET /api/activity?date=2025-01-12

# 3. Filter for different date - should return activity
GET /api/activity?date=2025-01-13

# 4. Get activity without filter - date should be excluded
GET /api/activity
# available_dates should NOT include 2025-01-12
```

---

## Frontend Integration

### Update API Service

Modify your frontend API calls to include date parameters:

```typescript
// Angular/Ionic example
getAllActivities(startDate?: string, endDate?: string) {
  let params = new HttpParams();
  if (startDate) params = params.set('startDate', startDate);
  if (endDate) params = params.set('endDate', endDate);

  return this.http.get(`${this.API}/activity`, { params });
}
```

### Update Home Page Filtering

The frontend filtering logic in `home.page.ts` already checks `available_dates`. The backend now ensures these dates exclude bookings automatically, so no frontend changes are needed for the booking logic itself.

---

## Performance Considerations

### Optimization Strategies

1. **Caching** (Future Enhancement)
   - Cache booked dates for each activity with short TTL
   - Invalidate cache when new bookings are created

2. **Database Indexing**
   - Index on `activity_booking.operator_activity_id`
   - Index on `activity_booking.date`
   - Index on `activity_booking.status`

3. **Batch Processing**
   - Current implementation uses `Promise.all()` for parallel processing
   - Processes all activities concurrently for better performance

---

## Error Handling

All endpoints handle errors gracefully:

- **No operators found:** Returns 404 with descriptive message
- **Database errors:** Returns 500 with error details
- **Invalid dates:** Silently skips invalid date formats
- **Missing data:** Returns empty arrays instead of crashing

---

## Future Enhancements

1. **Redis Caching**
   - Cache booked dates with 5-minute TTL
   - Invalidate on booking creation/cancellation

2. **Ransack Integration**
   - Add `available_dates_cont` predicate for advanced filtering
   - Support complex date queries

3. **Real-time Updates**
   - WebSocket notifications when availability changes
   - Push updates to connected clients

4. **Time-based Availability**
   - Support multiple bookings per day with time slots
   - Filter by both date and time

5. **Capacity Management**
   - Support `max_pax_per_day` field
   - Allow partial bookings instead of blocking entire days

---

## Troubleshooting

### Issue: Dates still showing as available after booking

**Solution:** Check booking status

```sql
SELECT date, status FROM activity_booking
WHERE operator_activity_id = 'act_123';
```

Ensure status is not 'cancelled'

### Issue: No results when filtering by date range

**Solution:** Verify date formats

- Backend expects: `YYYY-MM-DD`
- Database stores: `YYYY-MM-DD` or ISO format
- Ensure frontend sends correct format

### Issue: Performance slow with many activities

**Solution:** Add database indexes

```sql
CREATE INDEX idx_booking_operator_date
ON activity_booking(operator_activity_id, date, status);
```

---

## Related Documentation

- [RANSACK_README.md](./RANSACK_README.md) - Advanced search and filtering
- [AUTO_REFRESH_GUIDE.md](./AUTO_REFRESH_GUIDE.md) - Real-time updates
- API Documentation - Complete endpoint reference

---

## Support

For questions or issues, contact the development team or create an issue in the repository.

**Last Updated:** January 26, 2026  
**Version:** 1.0.0
