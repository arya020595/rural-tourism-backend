# Booking-Aware API Quick Reference

## Available Endpoints with Date Filtering

### 1. Get All Activities

```
GET /api/activity
GET /api/activity?date=2025-01-15
GET /api/activity?startDate=2025-01-10&endDate=2025-01-20
```

### 2. Get All Operator Activities

```
GET /api/operator-activities
GET /api/operator-activities?date=2025-01-15
GET /api/operator-activities?startDate=2025-01-10&endDate=2025-01-20
```

### 3. Get Operators by Activity ID

```
GET /api/operator-activities/activity/:activity_id
GET /api/operator-activities/activity/5?date=2025-01-15
GET /api/operator-activities/activity/5?startDate=2025-01-10&endDate=2025-01-20
```

### 4. Get Single Operator Activity (always excludes booked dates)

```
GET /api/operator-activities/:id
```

### 5. Get Activities by User

```
GET /api/operator-activities/user/:rt_user_id
GET /api/operator-activities/user/user_123?date=2025-01-15
GET /api/operator-activities/user/user_123?startDate=2025-01-10&endDate=2025-01-20
```

---

## Response Format

All endpoints return `available_dates` with booked dates automatically excluded:

```json
{
  "id": "act_123",
  "activity_name": "Rafting",
  "available_dates": ["2025-01-11", "2025-01-13", "2025-01-14"],
  "available_dates_list": ["2025-01-11", "2025-01-13", "2025-01-14"],
  ...
}
```

**Note:** If `available_dates` originally contained `2025-01-12` but that date is booked, it will be excluded from the response.

---

## Filter Behavior

### Single Date Filter (`?date=YYYY-MM-DD`)

- ✅ Returns activities that have the specified date available (after excluding bookings)
- ❌ Excludes activities if the date is booked

### Date Range Filter (`?startDate=...&endDate=...`)

- ✅ Returns activities with **ANY** available dates in the range
- ❌ Excludes activities with **NO** available dates in the range

### No Filter

- ✅ Returns all activities
- ✅ All responses still exclude booked dates from `available_dates`

---

## Examples

### Example 1: Check availability for Jan 12

**Setup:**

- Operator: Arya
- Activity: Rafting
- Original dates: `[2025-01-11, 2025-01-12, 2025-01-13]`
- Booking exists: `2025-01-12`

**Request:**

```
GET /api/activity?date=2025-01-12
```

**Response:**

```json
[]
```

_No results because Jan 12 is booked_

---

### Example 2: Check availability for Jan 13

**Request:**

```
GET /api/activity?date=2025-01-13
```

**Response:**

```json
[
  {
    "id": "act_123",
    "activity_name": "Rafting",
    "available_dates": ["2025-01-11", "2025-01-13"],
    ...
  }
]
```

_Returns activity because Jan 13 is available (Jan 12 excluded from available_dates)_

---

### Example 3: Check range Jan 11-14

**Request:**

```
GET /api/activity?startDate=2025-01-11&endDate=2025-01-14
```

**Response:**

```json
[
  {
    "id": "act_123",
    "activity_name": "Rafting",
    "available_dates": ["2025-01-11", "2025-01-13"],
    ...
  }
]
```

_Returns activity because it has availability on Jan 11 and 13 (Jan 12 excluded)_

---

## Frontend Usage

### Angular/Ionic Example

```typescript
// In your service
getActivitiesByDate(date: string) {
  return this.http.get(`${this.API}/activity?date=${date}`);
}

getActivitiesByDateRange(startDate: string, endDate: string) {
  return this.http.get(`${this.API}/activity?startDate=${startDate}&endDate=${endDate}`);
}

// In your component
loadActivities() {
  const selectedDate = '2025-01-15';
  this.apiService.getActivitiesByDate(selectedDate).subscribe(
    (activities) => {
      // activities already have booked dates excluded
      this.activities = activities;
    }
  );
}
```

### React Example

```javascript
const fetchActivities = async (startDate, endDate) => {
  const params = new URLSearchParams();
  if (startDate) params.append("startDate", startDate);
  if (endDate) params.append("endDate", endDate);

  const response = await fetch(`/api/activity?${params}`);
  return response.json();
};
```

---

## Important Notes

1. **All responses automatically exclude booked dates** - You don't need to filter on the frontend
2. **Only confirmed/completed bookings block dates** - Cancelled and pending bookings don't affect availability
3. **Date format must be YYYY-MM-DD** - Other formats may cause unexpected results
4. **Empty arrays mean no availability** - Not an error, just no matches for the criteria

---

See [BOOKING_AWARE_FILTERING.md](./BOOKING_AWARE_FILTERING.md) for complete documentation.
