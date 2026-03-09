# Slot-Based Booking Aware Filtering

## Overview

The activity filtering system now supports **time-slot based booking awareness**. A date is only excluded from results when **ALL** time slots for that date are fully booked.

## Data Structure

### operator_activities.available_dates

```json
[
  { "date": "2026-01-12", "time": "08:00 - 10:00", "price": 45 },
  { "date": "2026-01-12", "time": "10:00 - 12:00", "price": 45 },
  { "date": "2026-01-12", "time": "12:00 - 14:00", "price": 45 },
  { "date": "2026-01-13", "time": "08:00 - 10:00", "price": 45 }
]
```

### activity_booking table

| operator_activity_id | date       | time          | status |
| -------------------- | ---------- | ------------- | ------ |
| OA001                | 2026-01-12 | 08:00 - 10:00 | booked |
| OA001                | 2026-01-12 | 10:00 - 12:00 | paid   |
| OA001                | 2026-01-12 | 12:00 - 14:00 | booked |

## Filtering Logic

### 1. Partial Booking (Date Still Available)

**Scenario:** Only 2 out of 3 slots booked for 2026-01-12

**Bookings:**

- 08:00 - 10:00 ✅ Booked
- 10:00 - 12:00 ✅ Booked
- 12:00 - 14:00 ⚠️ Available

**Result:** Date 2026-01-12 **REMAINS** in available_dates with all 3 slots shown

```json
{
  "available_dates": [
    { "date": "2026-01-12", "time": "08:00 - 10:00", "price": 45 },
    { "date": "2026-01-12", "time": "10:00 - 12:00", "price": 45 },
    { "date": "2026-01-12", "time": "12:00 - 14:00", "price": 45 }
  ]
}
```

### 2. Fully Booked (Date Excluded)

**Scenario:** All 3 slots booked for 2026-01-12

**Bookings:**

- 08:00 - 10:00 ✅ Booked
- 10:00 - 12:00 ✅ Booked
- 12:00 - 14:00 ✅ Booked

**Result:** Date 2026-01-12 **EXCLUDED** from available_dates

```json
{
  "available_dates": [
    { "date": "2026-01-13", "time": "08:00 - 10:00", "price": 45 }
  ]
}
```

### 3. Date Range Filtering

**Query:** `?startDate=2026-01-11&endDate=2026-01-14`

**Available Dates:**

- 2026-01-11: 2 slots available
- 2026-01-12: 3 slots (all booked) ❌
- 2026-01-13: 1 slot available
- 2026-01-14: 3 slots available

**Result:**

```json
{
  "available_dates": [
    { "date": "2026-01-11", "time": "08:00 - 10:00", "price": 45 },
    { "date": "2026-01-11", "time": "10:00 - 12:00", "price": 45 },
    { "date": "2026-01-13", "time": "08:00 - 10:00", "price": 45 },
    { "date": "2026-01-14", "time": "08:00 - 10:00", "price": 45 },
    { "date": "2026-01-14", "time": "10:00 - 12:00", "price": 45 },
    { "date": "2026-01-14", "time": "12:00 - 14:00", "price": 45 }
  ]
}
```

## API Examples

### Example 1: Filter by Single Date (Fully Booked)

**Request:**

```
GET /api/activity?date=2026-01-12
```

**Response:**

```json
[]
```

_No results because all slots for 2026-01-12 are booked_

### Example 2: Filter by Single Date (Partially Booked)

**Request:**

```
GET /api/activity?date=2026-01-13
```

**Response:**

```json
[
  {
    "id": "OA001",
    "activity_name": "River Rafting",
    "available_dates": [
      { "date": "2026-01-13", "time": "08:00 - 10:00", "price": 45 }
    ]
  }
]
```

### Example 3: Filter by Date Range

**Request:**

```
GET /api/activity?startDate=2026-01-11&endDate=2026-01-14
```

**Response:**

```json
[
  {
    "id": "OA001",
    "activity_name": "River Rafting",
    "available_dates": [
      { "date": "2026-01-11", "time": "08:00 - 10:00", "price": 45 },
      { "date": "2026-01-11", "time": "10:00 - 12:00", "price": 45 },
      { "date": "2026-01-13", "time": "08:00 - 10:00", "price": 45 },
      { "date": "2026-01-14", "time": "08:00 - 10:00", "price": 45 }
    ]
  }
]
```

_Note: 2026-01-12 is excluded because all its slots are fully booked_

## Status Filter

Only bookings with the following statuses block time slots:

- ✅ `booked`
- ✅ `paid`

**Ignored statuses:**

- ❌ `cancelled`

## Implementation Details

### Key Functions

#### 1. getAllBookedSlotsGrouped()

```javascript
// Returns: { "OA001": { "2026-01-12": ["08:00 - 10:00", "10:00 - 12:00"] } }
const bookedSlotsMap = await getAllBookedSlotsGrouped(activityIds);
```

#### 2. filterAvailableDates()

```javascript
// Removes dates where ALL slots are booked
const actualAvailableDates = filterAvailableDates(originalDates, bookedSlots);
```

#### 3. matchesDateFilter()

```javascript
// Checks if activity has any available slots within date range
const matches = matchesDateFilter(actualDates, startDate, endDate);
```

## Performance Optimization

✅ **Single batch query** for all bookings (eliminates N+1 problem)

```javascript
// 100 activities = 2 queries total (not 101)
const bookings = await ActivityBooking.findAll({
  where: {
    operator_activity_id: { [Op.in]: operatorActivityIds },
    status: { [Op.in]: ["booked", "paid"] },
  },
});
```

✅ **In-memory grouping** for O(n) complexity

```javascript
// Groups bookings by activity -> date -> slots
bookings.forEach((booking) => {
  grouped[activity_id][date].push(time);
});
```

## Affected Endpoints

All endpoints now support slot-based filtering:

1. **GET /api/activity** - All activities with slot filtering
2. **GET /api/activity/:id** - Single activity by ID
3. **GET /api/activity/user/:user_id** - Activities by user
4. **GET /api/operator-activities** - All operator activities
5. **GET /api/operator-activities/activity/:activity_id** - Operators by activity
6. **GET /api/operator-activities/:id** - Single operator activity
7. **GET /api/operator-activities/user/:rt_user_id** - Activities by operator user

## Testing

### Test Scenario Setup

1. **Create test activity with 3 slots for 2026-01-12:**

```sql
INSERT INTO operator_activities (id, available_dates, ...) VALUES
('TEST_OA', '[
  {"date":"2026-01-12","time":"08:00 - 10:00","price":45},
  {"date":"2026-01-12","time":"10:00 - 12:00","price":45},
  {"date":"2026-01-12","time":"12:00 - 14:00","price":45}
]', ...);
```

2. **Book 2 out of 3 slots:**

```sql
INSERT INTO activity_booking (operator_activity_id, date, time, status) VALUES
('TEST_OA', '2026-01-12', '08:00 - 10:00', 'confirmed'),
('TEST_OA', '2026-01-12', '10:00 - 12:00', 'confirmed');
```

3. **Test partial booking:**

```bash
curl "http://localhost:3000/api/activity?date=2026-01-12"
# Should return the activity with all 3 slots
```

4. **Book the last slot:**

```sql
INSERT INTO activity_booking (operator_activity_id, date, time, status) VALUES
('TEST_OA', '2026-01-12', '12:00 - 14:00', 'confirmed');
```

5. **Test full booking:**

```bash
curl "http://localhost:3000/api/activity?date=2026-01-12"
# Should return empty array []
```

## Migration from Simple Date Filtering

### Old Behavior (Deprecated)

```javascript
// ❌ Old: Excluded date if ANY booking exists
const bookedDates = ["2026-01-12"];
available_dates = ["2026-01-12", "2026-01-13"];
result = ["2026-01-13"]; // Excluded entire date
```

### New Behavior (Current)

```javascript
// ✅ New: Excluded date only if ALL slots booked
const bookedSlots = {
  '2026-01-12': ['08:00 - 10:00', '10:00 - 12:00'] // 2/3 slots
};
available_dates = [
  {date: '2026-01-12', time: '08:00 - 10:00', price: 45},
  {date: '2026-01-12', time: '10:00 - 12:00', price: 45},
  {date: '2026-01-12', time: '12:00 - 14:00', price: 45}
];
result = [all 3 slots]; // Date still available!
```

## Edge Cases

### Case 1: Empty available_dates

```javascript
available_dates = [];
// Result: Activity excluded from all filters
```

### Case 2: Mismatched time slots

```javascript
// Booking has "08:00-10:00" but available has "08:00 - 10:00" (extra spaces)
// Solution: Exact string matching - ensure consistency in time format
```

### Case 3: Invalid date in booking

```javascript
date = "invalid-date";
// Solution: Validated with isNaN(date.getTime()) - safely ignored
```

### Case 4: No bookings

```javascript
bookedSlots = {};
// Result: All dates remain available (no filtering applied)
```

## Best Practices

1. **Time Format Consistency:** Always use `"HH:MM - HH:MM"` format with spaces
2. **Date Format:** ISO 8601 `YYYY-MM-DD` for reliable parsing
3. **Status Management:** Update booking status to `confirmed` only after payment
4. **Price Flexibility:** Each slot can have different pricing
5. **Slot Design:** Design time slots with appropriate buffers (e.g., 2-hour blocks)

## Future Enhancements

- [ ] Add real-time slot availability updates via WebSocket
- [ ] Implement slot capacity limits (e.g., 10 pax per slot)
- [ ] Add grace period before auto-cancelling pending bookings
- [ ] Support for recurring time slot patterns
- [ ] Booking wait-list for fully booked slots
