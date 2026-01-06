# Test Structure

This directory contains all tests organized by module type.

## Directory Structure

```
tests/
├── unit/                          # Unit tests (isolated component tests)
│   └── middleware/
│       └── ransackSearch.test.js  # Ransack middleware unit tests
│
└── integration/                   # Integration tests (API/E2E tests)
    └── routes/
        └── activityMasterData.test.js  # Activity routes integration tests
```

## Test Categories

### Unit Tests (`tests/unit/`)

Tests for individual components in isolation:

- **Middleware**: Business logic, validators, search builders
- **Models**: Database model definitions and methods
- **Utils**: Helper functions and utilities

### Integration Tests (`tests/integration/`)

Tests for complete workflows and API endpoints:

- **Routes**: Full API endpoint testing with database
- **Controllers**: Controller logic with dependencies
- **Services**: Service layer integration

## Running Tests

### Run All Tests

```bash
npm test
```

### Run by Category

```bash
# All unit tests
npm run test:unit

# All integration tests
npm run test:integration
```

### Run by Module

```bash
# Middleware tests only
npm run test:middleware

# Routes tests only
npm run test:routes
```

### Watch Mode

```bash
npm run test:watch
```

## Test Statistics

| Category        | Module     | Tests  | Status      |
| --------------- | ---------- | ------ | ----------- |
| **Unit**        | Middleware | 31     | ✅ 100%     |
| **Integration** | Routes     | 22     | ✅ 100%     |
| **Total**       | -          | **53** | ✅ **100%** |

## Adding New Tests

### For Unit Tests

Create test files in the appropriate module folder:

```
tests/unit/[module]/[component].test.js
```

Example:

```javascript
// tests/unit/middleware/auth.test.js
describe("Auth Middleware", () => {
  test("should validate token", () => {
    // test code
  });
});
```

### For Integration Tests

Create test files in the appropriate module folder:

```
tests/integration/[module]/[component].test.js
```

Example:

```javascript
// tests/integration/routes/user.test.js
const request = require("supertest");
const app = require("../../server");

describe("User Routes", () => {
  test("GET /api/users", async () => {
    const response = await request(app).get("/api/users").expect(200);
  });
});
```

## Test Naming Conventions

- Test files: `*.test.js`
- Describe blocks: Use component/feature name
- Test names: Use "should" statements

```javascript
describe("ComponentName", () => {
  describe("methodName", () => {
    test("should do something specific", () => {
      // test
    });
  });
});
```

## Coverage Reports

After running tests, view coverage:

```bash
# Open HTML coverage report
open coverage/lcov-report/index.html
```

## Best Practices

1. **Isolation**: Unit tests should not depend on external services
2. **Cleanup**: Always clean up test data in `afterEach` or `afterAll`
3. **Descriptive**: Test names should clearly describe what they test
4. **Fast**: Unit tests should run quickly (< 100ms per test)
5. **Independent**: Tests should not depend on each other's execution order

## Continuous Integration

Tests run automatically on:

- Pre-commit hooks
- Pull requests
- Main branch pushes
- Scheduled builds

## Current Test Modules

### Unit Tests

#### Middleware (`tests/unit/middleware/`)

- ✅ **ransackSearch.test.js** - Search, filter, sort, and pagination middleware
  - 31 tests covering all predicates
  - Edge cases and error handling
  - 100% coverage

### Integration Tests

#### Routes (`tests/integration/routes/`)

- ✅ **activityMasterData.test.js** - Activity Master Data API endpoints
  - 22 tests covering CRUD operations
  - Search, filter, and pagination scenarios
  - Combined query testing
  - 100% success rate

## Future Test Modules

Planned test additions:

- `tests/unit/utils/` - Utility function tests
- `tests/unit/validators/` - Input validation tests
- `tests/integration/routes/accomRoutes.test.js` - Accommodation routes
- `tests/integration/routes/bookingRoutes.test.js` - Booking routes
- `tests/integration/routes/userRoutes.test.js` - User authentication routes

---

**Last Updated**: December 30, 2025  
**Total Tests**: 53  
**Success Rate**: 100%
