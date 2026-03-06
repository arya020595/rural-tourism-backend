# Service Layer Architecture - SOLID Principles

## Overview

The codebase has been refactored to follow SOLID principles by introducing a **Service Layer** that separates business logic from HTTP request handling.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Client Request                          │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                  Routes (activityRoutes.js)                  │
│  • HTTP routing                                              │
│  • Request parameter extraction                              │
│  • Delegates to Controller                                   │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│          Controllers (activityController.js)                  │
│  • HTTP request/response handling                            │
│  • Data validation & error handling                          │
│  • Calls Service for business logic                          │
│  • Formats response for client                               │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│         Services (operatorActivityService.js)                │
│  • Business logic implementation                             │
│  • Booking-aware filtering                                   │
│  • Date slot management                                      │
│  • Data transformation                                       │
│  • Reusable across controllers                               │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                Models (Sequelize ORM)                        │
│  • Database schema definition                                │
│  • Data persistence                                          │
│  • Relationships                                             │
└─────────────────────────────────────────────────────────────┘
```

## SOLID Principles Applied

### 1. **S**ingle Responsibility Principle (SRP)

Each class/module has ONE reason to change:

- **Routes**: Handle HTTP routing only
- **Controllers**: Handle HTTP requests/responses only
- **Services**: Handle business logic only
- **Models**: Handle data persistence only

**Before (Violated SRP):**

```javascript
// Controller had business logic mixed with HTTP handling
exports.getAllOperatorActivities = async (req, res) => {
  // Business logic embedded here
  const bookings = await ActivityBooking.findAll({...});
  const grouped = {};
  bookings.forEach(booking => {
    // Complex grouping logic
  });
  // Date filtering logic
  // ...
};
```

**After (Follows SRP):**

```javascript
// Controller: HTTP handling only
exports.getAllOperatorActivities = async (req, res) => {
  const { startDate, endDate, date } = req.query;
  const activities = await OperatorActivity.findAll();
  const filtered = await operatorActivityService.applyBookingAwareFiltering(
    activities,
    { date, startDate, endDate }
  );
  res.json(filtered);
};

// Service: Business logic only
async applyBookingAwareFiltering(activities, filters) {
  // All business logic here
}
```

### 2. **O**pen/Closed Principle (OCP)

Code is open for extension but closed for modification:

- Service methods are extensible through parameters
- New filtering strategies can be added without modifying existing code

**Example:**

```javascript
// Easy to extend with new filter types
async applyBookingAwareFiltering(activities, filters = {}) {
  const { date, startDate, endDate, status, district } = filters;
  // Can add new filters without breaking existing code
}
```

### 3. **L**iskov Substitution Principle (LSP)

Service can be replaced with different implementations:

```javascript
// Could create different service implementations
class OperatorActivityService { ... }
class CachedOperatorActivityService extends OperatorActivityService { ... }
class MockOperatorActivityService extends OperatorActivityService { ... }

// Controller doesn't care which implementation
const service = process.env.USE_CACHE
  ? new CachedOperatorActivityService()
  : new OperatorActivityService();
```

### 4. **I**nterface Segregation Principle (ISP)

Service provides focused, specific methods:

```javascript
// Specific methods for specific needs
service.parseJSONField(field);
service.getAllBookedSlotsGrouped(ids);
service.filterAvailableDates(dates, slots);
service.matchesDateFilter(dates, start, end);
service.applyBookingAwareFiltering(activities, filters);
service.applyBookingAwareFilteringToSingle(activity);
```

### 5. **D**ependency Inversion Principle (DIP)

High-level modules depend on abstractions, not concretions:

```javascript
// Controller depends on service abstraction
const operatorActivityService = require("../services/operatorActivityService");

// Not on low-level database details
// const ActivityBooking = require("../models/bookingActivityModel");
```

## File Structure

```
RT-backend-main/
├── routes/
│   └── activityRoutes.js              # HTTP routing
├── controllers/
│   └── activityController.js # HTTP request/response
├── services/                           # ✨ NEW: Business logic layer
│   └── operatorActivityService.js     # Booking-aware filtering logic
└── models/
    ├── operatorActivitiesModel.js     # Database schema
    └── bookingActivityModel.js        # Database schema
```

## Service Layer (operatorActivityService.js)

### Class: OperatorActivityService

#### Methods:

##### 1. `parseJSONField(field)`

Safely parses JSON fields from database.

**Parameters:**

- `field` (string|array): JSON string or already parsed array

**Returns:** `array` - Parsed array or empty array on error

**Example:**

```javascript
const dates = service.parseJSONField(activity.available_dates);
// Returns: [{date: "2026-01-12", time: "08:00 - 10:00", price: 45}, ...]
```

---

##### 2. `getAllBookedSlotsGrouped(operatorActivityIds)`

Fetches all booked slots in a single optimized query.

**Parameters:**

- `operatorActivityIds` (array): Array of operator activity IDs

**Returns:** `object` - Grouped booked slots

```javascript
{
  "OA001": {
    "2026-01-12": ["08:00 - 10:00", "10:00 - 12:00"],
    "2026-01-13": ["08:00 - 10:00"]
  }
}
```

**Performance:** O(n) with single database query

---

##### 3. `normalizeDate(dateStr)`

Normalizes date string to YYYY-MM-DD format.

**Parameters:**

- `dateStr` (string): Date string in any format

**Returns:** `string|null` - Normalized date or null if invalid

---

##### 4. `filterAvailableDates(availableDates, bookedSlots)`

Filters out fully booked dates.

**Parameters:**

- `availableDates` (array): Array of slot objects `[{date, time, price}]`
- `bookedSlots` (object): Grouped booked slots by date

**Returns:** `array` - Filtered slot objects

**Logic:**

- Only excludes dates where ALL time slots are booked
- Partial bookings keep the date available

---

##### 5. `matchesDateFilter(actualAvailableDates, filterStartDate, filterEndDate)`

Checks if activity matches date filter criteria.

**Parameters:**

- `actualAvailableDates` (array): Available slot objects
- `filterStartDate` (string): Start date filter (optional)
- `filterEndDate` (string): End date filter (optional)

**Returns:** `boolean` - True if activity matches filter

---

##### 6. `applyBookingAwareFiltering(activities, filters)`

Main filtering method - applies booking-aware filtering to multiple activities.

**Parameters:**

- `activities` (array): Array of activity objects
- `filters` (object): Filter options `{date, startDate, endDate}`

**Returns:** `array` - Filtered activities with actual available dates

**Usage:**

```javascript
const filtered = await service.applyBookingAwareFiltering(activities, {
  date: "2026-01-12",
});
```

---

##### 7. `applyBookingAwareFilteringToSingle(activity)`

Applies filtering to a single activity.

**Parameters:**

- `activity` (object): Single activity object

**Returns:** `object` - Activity with actual available dates

**Usage:**

```javascript
const filtered = await service.applyBookingAwareFilteringToSingle(activity);
```

## Benefits of Service Layer

### ✅ **Testability**

Services can be tested independently:

```javascript
// Easy to unit test
const service = require("./operatorActivityService");

describe("OperatorActivityService", () => {
  test("filters fully booked dates", () => {
    const dates = [{ date: "2026-01-12", time: "08:00-10:00" }];
    const booked = { "2026-01-12": ["08:00-10:00"] };
    const result = service.filterAvailableDates(dates, booked);
    expect(result).toEqual([]);
  });
});
```

### ✅ **Reusability**

Same service used in multiple places:

```javascript
// In controller
const filtered = await service.applyBookingAwareFiltering(activities, filters);

// In routes
const filtered = await service.applyBookingAwareFiltering(activities, filters);

// In cron jobs
const filtered = await service.applyBookingAwareFiltering(activities, filters);
```

### ✅ **Maintainability**

Business logic in one place:

- Need to change filtering? Update service only
- No need to modify controllers or routes
- Changes propagate automatically

### ✅ **Extensibility**

Easy to add new features:

```javascript
// Add caching
class CachedOperatorActivityService extends OperatorActivityService {
  async getAllBookedSlotsGrouped(ids) {
    const cached = await cache.get(ids);
    if (cached) return cached;
    const result = await super.getAllBookedSlotsGrouped(ids);
    await cache.set(ids, result);
    return result;
  }
}
```

### ✅ **Dependency Injection**

Easy to mock for testing:

```javascript
// In tests
const mockService = {
  applyBookingAwareFiltering: jest.fn().mockResolvedValue([]),
};

// Inject mock service
const controller = createController(mockService);
```

## Migration Guide

### Before (Anti-Pattern):

```javascript
// ❌ Business logic in controller
exports.getAllActivities = async (req, res) => {
  const bookings = await ActivityBooking.findAll({...});
  const grouped = {};
  bookings.forEach(b => { /* complex logic */ });
  // More business logic...
  res.json(result);
};
```

### After (SOLID Pattern):

```javascript
// ✅ Service handles business logic
class OperatorActivityService {
  async applyBookingAwareFiltering(activities, filters) {
    // All business logic here
  }
}

// ✅ Controller handles HTTP only
exports.getAllActivities = async (req, res) => {
  const activities = await OperatorActivity.findAll();
  const filtered = await service.applyBookingAwareFiltering(
    activities,
    req.query,
  );
  res.json(filtered);
};
```

## Best Practices

1. **Keep controllers thin** - Only HTTP concerns
2. **Keep services focused** - Single responsibility
3. **Use dependency injection** - Pass services to controllers
4. **Write unit tests** - Test services independently
5. **Document public methods** - Clear API contracts
6. **Use TypeScript** (future) - Type safety for service interfaces

## Testing Example

```javascript
// tests/services/operatorActivityService.test.js
const service = require("../../services/operatorActivityService");

describe("OperatorActivityService", () => {
  describe("filterAvailableDates", () => {
    test("excludes fully booked dates", () => {
      const available = [
        { date: "2026-01-12", time: "08:00-10:00" },
        { date: "2026-01-12", time: "10:00-12:00" },
      ];
      const booked = {
        "2026-01-12": ["08:00-10:00", "10:00-12:00"],
      };

      const result = service.filterAvailableDates(available, booked);

      expect(result).toEqual([]);
    });

    test("keeps partially booked dates", () => {
      const available = [
        { date: "2026-01-12", time: "08:00-10:00" },
        { date: "2026-01-12", time: "10:00-12:00" },
      ];
      const booked = {
        "2026-01-12": ["08:00-10:00"],
      };

      const result = service.filterAvailableDates(available, booked);

      expect(result).toHaveLength(2);
    });
  });
});
```

## Future Enhancements

- [ ] Add TypeScript interfaces for service contracts
- [ ] Implement caching layer in service
- [ ] Add service-level logging
- [ ] Create service factory pattern
- [ ] Add service health checks
- [ ] Implement circuit breaker pattern
