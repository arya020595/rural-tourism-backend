# Ransack Search Middleware

A Rails-inspired search and filter middleware for Node.js/Express with Sequelize ORM.

## Features

- 🔍 **11 Search Predicates** - eq, cont, start, end, gt, gte, lt, lte, in, not_eq, not_cont
- 📊 **Flexible Sorting** - Sort by any field in ASC/DESC order
- 📄 **Smart Pagination** - Page-based pagination with metadata
- 🔗 **Chainable Queries** - Combine search, sort, and pagination
- ✅ **100% Test Coverage** - 53 passing tests

## Quick Start

### Installation

The middleware is already set up in `/middleware/ransackSearch.js`

### Basic Usage

```javascript
const { ransackMiddleware } = require("./middleware/ransackSearch");

router.get("/activities", ransackMiddleware, async (req, res) => {
  const options = req.ransack.toSequelizeOptions();
  const results = await Activity.findAll(options);
  res.json(results);
});
```

## API Examples

### Search Predicates

```bash
# Contains (case-insensitive)
GET /api/activity-master-data?q[activity_name_cont]=Beach

# Exact match
GET /api/activity-master-data?q[id_eq]=5

# Starts with
GET /api/activity-master-data?q[activity_name_start]=Mount

# Ends with
GET /api/activity-master-data?q[activity_name_end]=Tour

# Greater than
GET /api/activity-master-data?q[id_gt]=10

# Less than or equal
GET /api/activity-master-data?q[price_lte]=500

# In array
GET /api/activity-master-data?q[id_in]=1,2,3

# Not equals
GET /api/activity-master-data?q[status_not_eq]=inactive

# Does not contain
GET /api/activity-master-data?q[activity_name_not_cont]=Test
```

### Sorting

```bash
# Sort descending (with suffix)
GET /api/activity-master-data?sort=activity_name_desc

# Sort ascending (with suffix)
GET /api/activity-master-data?sort=created_at_asc

# Sort with separate order param
GET /api/activity-master-data?sort=price&order=DESC
```

### Pagination

```bash
# Page 1, 10 items (default)
GET /api/activity-master-data

# Page 2, 20 items per page
GET /api/activity-master-data?page=2&per_page=20

# Using 'limit' instead of 'per_page'
GET /api/activity-master-data?page=1&limit=15
```

### Combined Queries

```bash
# Search + Sort + Paginate
GET /api/activity-master-data?q[activity_name_cont]=Hiking&q[price_gte]=100&sort=price_asc&page=1&per_page=5
```

## Response Format

```json
{
  "data": [
    {
      "id": 1,
      "activity_name": "Kiulu Water Rafting",
      "description": "...",
      "price": 150
    }
  ],
  "pagination": {
    "total": 25,
    "page": 1,
    "per_page": 10,
    "total_pages": 3,
    "has_next": true,
    "has_prev": false
  }
}
```

## Predicate Reference

| Predicate  | Description           | SQL Equivalent                   |
| ---------- | --------------------- | -------------------------------- |
| `eq`       | Equals                | `WHERE field = value`            |
| `cont`     | Contains              | `WHERE field LIKE '%value%'`     |
| `start`    | Starts with           | `WHERE field LIKE 'value%'`      |
| `end`      | Ends with             | `WHERE field LIKE '%value'`      |
| `gt`       | Greater than          | `WHERE field > value`            |
| `gte`      | Greater than or equal | `WHERE field >= value`           |
| `lt`       | Less than             | `WHERE field < value`            |
| `lte`      | Less than or equal    | `WHERE field <= value`           |
| `in`       | In array              | `WHERE field IN (val1, val2)`    |
| `not_eq`   | Not equals            | `WHERE field != value`           |
| `not_cont` | Does not contain      | `WHERE field NOT LIKE '%value%'` |

## Advanced Examples

### Multiple Conditions on Same Field

```bash
# Price between 100 and 500
GET /api/activity-master-data?q[price_gte]=100&q[price_lte]=500
```

### Complex Filtering

```bash
# Active hiking activities in Sabah, sorted by price
GET /api/activity-master-data?q[activity_name_cont]=Hiking&q[address_cont]=Sabah&q[status_eq]=active&sort=price_asc
```

### Case-Insensitive Search

```bash
# All searches are case-insensitive by default
GET /api/activity-master-data?q[activity_name_cont]=beach
# Matches: "Beach", "BEACH", "Beach Tour", etc.
```

## Testing

Run all tests:

```bash
npm test
```

Run specific test suites:

```bash
# Unit tests only
npm run test:unit

# Integration tests only
npm run test:integration

# Watch mode
npm run test:watch
```

## Test Coverage

- **Unit Tests**: 31 tests covering all predicates and edge cases
- **Integration Tests**: 22 tests covering full API functionality
- **Total Coverage**: 53 passing tests, 100% success rate

## Implementation Details

### Middleware Structure

The `ransackMiddleware` attaches a `ransack` object to the request:

```javascript
req.ransack = {
  where: {
    /* Sequelize where conditions */
  },
  order: [
    /* Sequelize order array */
  ],
  limit: 10,
  offset: 0,
  toSequelizeOptions: () => {
    /* Helper function */
  },
};
```

### Helper Functions

```javascript
// Build search conditions
const where = buildSearchQuery(req.query);

// Build sorting
const order = buildSort(req.query);

// Build pagination
const pagination = buildPagination(req.query);
```

## Files

- `/middleware/ransackSearch.js` - Main middleware implementation
- `/tests/ransackSearch.test.js` - Unit tests
- `/tests/activityMasterData.test.js` - Integration tests
- `/routes/activityMasterDataRoutes.js` - Example usage

## Compatibility

- Node.js >= 18.0.0
- Express >= 4.16.0
- Sequelize >= 6.0.0
- sequelize-paginate >= 2.0.0

## License

MIT

## Credits

Inspired by Rails Ransack gem for elegant search and filter queries.
