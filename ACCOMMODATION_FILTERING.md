# Accommodation Booking-Aware Filtering

## Overview

Similar to the activity filtering system, but **simpler** because accommodations don't have time slots - only dates.

## Key Difference from Activity Filtering

| Feature             | Activity Filtering                          | Accommodation Filtering                        |
| ------------------- | ------------------------------------------- | ---------------------------------------------- |
| **Data Structure**  | Dates + Time Slots                          | Dates only (no time)                           |
| **Exclusion Logic** | Exclude date when ALL time slots are booked | Exclude date when it's booked                  |
| **Booking Table**   | `activity_booking` (date + time_slot)       | `accommodation_booking` (check_in + check_out) |
| **Statuses**        | "booked", "paid" block; "cancelled" ignored | "booked", "paid" block; "cancelled" ignored    |

## Architecture

```
Routes (accomRoutes.js)
    ↓
Controllers (accomController.js)
    ↓
Services (accommodationService.js)
    ↓
Models (Accom, AccommodationBooking)
```

## How It Works

### 1. Accommodation Model

```javascript
available_dates: [
  {date: "2026-02-01", price: 250},
  {date: "2026-02-02", price: 250},
  {date: "2026-02-03", price: 250},
  ...
]
```

**Note:** Objects with date and price (no time slots). Each date has an associated price per night.

### 2. Accommodation Booking Model

```javascript
{
  check_in: "2026-02-01",
  check_out: "2026-02-03",  // Blocks: Feb 1, 2, 3
  status: "booked"           // "booked" or "paid" blocks dates
}
```

### 3. Filtering Process

**Step 1: Fetch all bookings** (one optimized query)

```sql
SELECT accommodation_id, check_in, check_out
FROM accommodation_booking
WHERE accommodation_id IN (1, 2, 3, ...)
AND status IN ('booked', 'paid');
```

**Step 2: Expand check-in to check-out ranges**

```javascript
Booking: check_in=2026-02-01, check_out=2026-02-03
Blocked dates: ["2026-02-01", "2026-02-02", "2026-02-03"]
```

**Step 3: Filter available dates**

```javascript
Available: [
  {date: "2026-02-01", price: 250},
  {date: "2026-02-02", price: 250},
  {date: "2026-02-03", price: 250},
  {date: "2026-02-04", price: 250}
];
Booked dates: ["2026-02-02"];
Result: [
  {date: "2026-02-01", price: 250},
  {date: "2026-02-03", price: 250},
  {date: "2026-02-04", price: 250}
];
```

**Step 4: Apply date range filter (if provided)**

```javascript
Query: ?startDate=2026-02-01&endDate=2026-02-03
Result: [
  {date: "2026-02-01", price: 250},
  {date: "2026-02-03", price: 250}
]  // Only dates in range
```

## API Endpoints

### GET /api/accom

Get all accommodations with optional date filtering

**Query Parameters:**

- `date` - Single date (YYYY-MM-DD)
- `startDate` - Start of date range (YYYY-MM-DD)
- `endDate` - End of date range (YYYY-MM-DD)

**Examples:**

```bash
# All accommodations (with booking-aware filtering)
curl http://localhost:3000/api/accom

# Accommodations available on specific date
curl http://localhost:3000/api/accom?date=2026-02-15

# Accommodations available in date range
curl http://localhost:3000/api/accom?startDate=2026-02-01&endDate=2026-02-10
```

**Response:**

```json
[
  {
    "accommodation_id": 1,
    "name": "Cozy Homestay",
    "available_dates": [
      { "date": "2026-02-01", "price": 250 },
      { "date": "2026-02-03", "price": 250 },
      { "date": "2026-02-04", "price": 250 }
    ],
    "price": "150.00",
    "user_id": "OP001",
    "homest_id": 1,
    "homest_name": "Cozy Homestay"
  }
]
```

### Other Endpoints

- `GET /api/accom/user/:user_id` - Get accommodations by user
- `GET /api/accom/:id` - Get single accommodation
- `POST /api/accom` - Create accommodation
- `PUT /api/accom/:id` - Update accommodation
- `DELETE /api/accom/:id` - Delete accommodation

## Service Layer Methods

### accommodationService.js

#### `getAllBookedDatesGrouped(accommodationIds)`

Fetches all booked dates for multiple accommodations in **one optimized query**.

**Returns:**

```javascript
{
  "1": ["2026-02-01", "2026-02-02", "2026-02-03"],
  "2": ["2026-02-15"],
  "3": []
}
```

#### `filterAvailableDates(availableDates, bookedDates)`

Removes booked dates from available dates. Handles both string and object formats.

```javascript
Input: availableDates: [
  { date: "2026-02-01", price: 250 },
  { date: "2026-02-02", price: 250 },
  { date: "2026-02-03", price: 250 },
];
bookedDates: ["2026-02-02"];

Output: [
  { date: "2026-02-01", price: 250 },
  { date: "2026-02-03", price: 250 },
];
```

#### `applyBookingAwareFiltering(accommodations, filters)`

Main filtering method. Applies booking-aware filtering and date range filtering.

```javascript
const accommodations = await Accom.findAll();
const filtered = await accommodationService.applyBookingAwareFiltering(
  accommodations,
  { startDate: "2026-02-01", endDate: "2026-02-10" },
);
```

## Status Handling

| Status      | Effect                                     |
| ----------- | ------------------------------------------ |
| `booked`    | ✅ Blocks the date                         |
| `paid`      | ✅ Blocks the date                         |
| `cancelled` | ❌ Does NOT block (date remains available) |
| `pending`   | ❌ Does NOT block                          |

## Example Scenario

**Accommodation Data:**

```javascript
{
  accommodation_id: 1,
  name: "Mountain View Homestay",
  available_dates: [
    {date: "2026-02-01", price: 250},
    {date: "2026-02-02", price: 250},
    {date: "2026-02-03", price: 250},
    {date: "2026-02-04", price: 250},
    {date: "2026-02-05", price: 250}
  ]
}
```

**Bookings:**

```javascript
[
  { check_in: "2026-02-02", check_out: "2026-02-03", status: "booked" },
  { check_in: "2026-02-04", check_out: "2026-02-04", status: "cancelled" },
];
```

**Blocked Dates:**

- Feb 2 (booked)
- Feb 3 (booked)
- Feb 4 is NOT blocked (cancelled booking ignored)

**API Response:**

```javascript
{
  accommodation_id: 1,
  name: "Mountain View Homestay",
  available_dates: [
    {date: "2026-02-01", price: 250},
    {date: "2026-02-04", price: 250},
    {date: "2026-02-05", price: 250}
  ]
}
```

## Performance Optimization

✅ **Single Query for All Bookings**

```javascript
// ONE query for all accommodations
const bookedDatesMap = await getAllBookedDatesGrouped([1, 2, 3, 4]);

// vs BAD: N queries (one per accommodation)
for (const accom of accommodations) {
  await getBookedDates(accom.id); // ❌ Slow!
}
```

✅ **Efficient Date Expansion**

```javascript
// Efficiently expands check-in to check-out range
for (let d = checkIn; d <= checkOut; d.setDate(d.getDate() + 1)) {
  bookedDates.add(d.toISOString().split("T")[0]);
}
```

## Testing

Test the filtering functionality:

```bash
# Start server
npm start

# Test without filter (should return all accommodations)
curl http://localhost:3000/api/accom

# Test with date filter
curl "http://localhost:3000/api/accom?startDate=2026-02-01&endDate=2026-02-10"

# Test single date
curl "http://localhost:3000/api/accom?date=2026-02-05"
```

## Files Created/Modified

### Created:

1. **services/accommodationService.js** - Business logic for accommodation filtering
2. **controllers/accomController.js** - HTTP request/response handling
3. **ACCOMMODATION_FILTERING.md** - This documentation

### Modified:

1. **routes/accomRoutes.js** - Updated to use controller
2. **SOLID_ARCHITECTURE.md** - Updated with accommodation examples

## Comparison with Activity Filtering

### Similarities:

- ✅ SOLID architecture (Routes → Controllers → Services → Models)
- ✅ Optimized single query for bookings
- ✅ Status-based filtering (booked/paid)
- ✅ Date range filtering support
- ✅ Cancelled bookings ignored

### Differences:

- ❌ **NO time slots** (accommodations only have dates)
- ✅ **Simpler logic** (blocks entire date when booked)
- ✅ **Date range expansion** (check-in to check-out creates blocked dates)
- ✅ **Clean data structure** (array of date strings)

## Summary

The accommodation filtering is a **simplified version** of activity filtering:

- **Activities**: "Exclude date when ALL time slots for that date are booked" (slot-level filtering)
  - Data: `{date, time, price}` objects
- **Accommodations**: "Exclude entire date when any booking exists" (date-level filtering)
  - Data: `{date, price}` objects (no time slots)
- **Result**: Different data structures for different use cases - activities have time slots, accommodations have per-night pricing

Both follow the same SOLID architecture and optimization strategies, ensuring consistent, maintainable code.
