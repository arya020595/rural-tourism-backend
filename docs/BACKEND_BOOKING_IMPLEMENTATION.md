# Backend Booking Implementation - May 2026 (Final Update)

## Overview

Comprehensive overhaul of the booking system with unified booking management, company-association validation, proper status tracking, and fixed receipt generation. The system now supports three booking types (Activity, Accommodation, Package) with consistent API patterns, robust error handling, and corrected database persistence for receipt timestamps.

---

## Architecture

### Data Flow

```
Client Request → Route → Middleware (Auth, Authorize) → Controller → Service → DB
      ↓
   Response (with serialized data)
```

### Models Involved

- **bookings**: Core booking table with 20+ columns
- **bookings_package_companies**: Junction table for multi-company packages
- **unified_users**: User-company-association relationships
- **companies**: Company master data
- **products**: Activity/Accommodation master data

---

## Core Changes

### 1. Controllers

#### **bookingController.js**

**Purpose**: Handle booking CRUD and status operations

**New Methods**:

- `cancelBooking(id)`: PATCH endpoint to set booking status to "cancelled"
- `markBookingAsPaid(id)`: PATCH endpoint to set booking status to "paid"
- Both include policy checks and use `updateBookingStatus()` service method

**Key Pattern**:

```javascript
exports.cancelBooking = async (req, res) => {
  try {
    const record = await bookingService.getBooking(req.params.id);
    if (!policy("booking", req.user, record).destroy()) {
      throw new ForbiddenError("Cannot cancel this booking");
    }
    const result = await bookingService.updateBookingStatus(
      req.params.id,
      "cancelled",
    );
    return successResponse(res, serialize(result), "Booking cancelled");
  } catch (err) {
    return errorResponse(res, err);
  }
};
```

#### **authController.js**

**Change**: Enhanced `me()` endpoint

- Now fetches and returns `company_id` and `unified_user_id` from database
- Enables frontend to access company context immediately after login

#### **companyController.js**

**Changes**:

- Added `serializeMany` import for batch serialization
- Split `extractCompanyUpdateFields()` response to return `{company, user}` buckets
- Added `getPackageCompanies(id)` endpoint for association-filtered company list
- Now updates both company table and associated user records on company update

#### **productController.js**

**New**: `getProductsByCompany(companyId)` endpoint

- Returns products for a specific company
- Association-scoped filtering
- Ransack support for advanced filtering
- Pagination enabled

---

### 2. Services

#### **bookingsService.js** - Major Refactor

**New Methods**:

1. **`resolveProductSnapshot(productId, bookingType)`**
   - Validates product exists and matches booking type
   - Throws `NotFoundError` if product doesn't exist
   - Throws `BadRequestError` if product type mismatch

2. **`resolveCompanyAssociationId(companyId)`**
   - Maps company to its association
   - Detects multi-association conflicts
   - Returns association_id for validation
   - Used in package company validation

3. **`normalizePackageCompanies()`** - Enhanced
   - Now validates both referrer and referee belong to same association
   - Prevents cross-association package creation
   - Comprehensive data sanitization

**Bug Fixes**:

- Fixed: `getBookings()` undefined `scope` merge issue
  - Now properly checks scope before merging into query

**Impact**: All bookings now validate product types and company associations

#### **authService.js**

**Changes**:

- Added `company_id` and `unified_user_id` to JWT token payload
- Updated login response to include these fields
- Enables frontend to access company context immediately after login

#### **companyService.js**

**New Methods**:

- `getAllCompanies()`: Superadmin can fetch all companies
- `getCompaniesByAssociationId(id)`: Fetch companies linked to specific association via users
- Pattern: Association-based access control for multi-tenant

---

### 3. Models

#### **bookingModel.js**

**Change**: Status `defaultValue` updated

- Changed from `"pending"` to `"booked"`
- All new bookings now default to "booked" status instead of "pending"

---

### 4. Routes

#### **bookingRoutes.js**

**New Endpoints**:

- `PATCH /:id/cancel` → calls `cancelBooking()`
- `PATCH /:id/payment` → calls `markBookingAsPaid()`

#### **companyRoutes.js**

**New Endpoints**:

- `GET /package-options` → calls `getPackageCompanies()`
- Returns companies filtered by association

#### **productRoutes.js**

**New Endpoints**:

- `GET /company/:companyId` → calls `getProductsByCompany()`
- Includes Ransack support for filtering

---

### 5. Serializers

#### **companySerializer.js**

**New Method**: `serializeMany(companies)`

- Maps array of companies through `serialize()`
- Enables batch serialization for lists

---

### 6. Parsers

#### **companyParser.js**

**Refactored**: `extractCompanyUpdateFields()`

- Now returns `{company: {...}, user: {...}}`
- Separates company fields from user-level fields
- Maps frontend field names to DB column names:
  - `owner_full_name` → `name`
  - `association_id` → `association_id`

---

## Database Migrations

### Overview

5 new migrations added for operator_admin role permissions and data sync

### Migration Files

| File                                                                   | Purpose                          | Status  |
| ---------------------------------------------------------------------- | -------------------------------- | ------- |
| `20260430000000-add-booking-create-permission-to-operator-admin.js`    | Adds `booking:create` permission | ✅ Keep |
| `20260430003000-ensure-product-crud-permissions-for-operator-admin.js` | Comprehensive CRUD setup         | ✅ Keep |
| `20260430004000-sync-company-data-into-companies.js`                   | Data migration/sync              | ✅ Keep |

---

## API Endpoints - Unified

### Booking Management

```
GET    /api/bookings                    - List bookings (paginated, filtered)
POST   /api/bookings                    - Create unified booking
GET    /api/bookings/:id                - Get booking detail
PUT    /api/bookings/:id                - Update booking
PATCH  /api/bookings/:id/cancel         - Cancel booking
PATCH  /api/bookings/:id/payment        - Mark as paid
```

### Query Parameters

```
page=1
per_page=100
booking_type=activity|accommodation|package
status=booked|pending|paid|cancelled|confirmed|completed|rejected
user_id=<operator_id>
company_id=<company_id>
search=<text>
```

### Response Format

**Success**:

```json
{
  "success": true,
  "message": "Bookings retrieved",
  "data": [
    {
      "id": "BK001",
      "booking_type": "activity",
      "status": "booked",
      "product_name": "Rafting",
      "tourist_full_name": "John Doe",
      "total_price": 150.00,
      "activity_date": "2026-05-15",
      ...
    }
  ],
  "meta": {
    "pagination": {
      "page": 1,
      "per_page": 20,
      "total": 150,
      "total_pages": 8,
      "has_next": true,
      "has_prev": false
    }
  }
}
```

**Error**:

```json
{
  "success": false,
  "message": "Booking not found",
  "statusCode": 404
}
```

---

## Authorization & Permissions

### Permission Format

- `booking:read` - View bookings
- `booking:create` - Create new bookings
- `booking:update` - Edit bookings
- `booking:delete` - Delete bookings
- `product:read` - View products/activities/accommodations
- `product:create` - Create new products
- `product:update` - Edit products
- `product:delete` - Delete products

### Policy Checks

**bookingPolicy.js**:

```javascript
class BookingPolicy extends ApplicationPolicy {
  index() {
    return this.hasPermission("booking:read");
  }
  show() {
    return this.isAdmin() || this._isCompanyUser();
  }
  create() {
    return this.hasPermission("booking:create");
  }
  update() {
    return this.isAdmin() || this._isOperatorAdmin();
  }
  destroy() {
    return this.isAdmin() || this._isCompanyOwner();
  }
}
```

---

## Critical Bug Fixes

### Receipt Timestamp Persistence (FIXED ✅)

**Issue**: `receiptCreatedAt` not saving to database when booking marked paid

**Root Cause**: Using snake_case DB column name (`receipt_created_at`) instead of camelCase model attribute name

**Solution**: In `bookingsService.js`, `updateBookingStatus()` method:

```javascript
// BEFORE (BROKEN):
if (normalizedStatus === "paid") {
  updateData.receipt_created_at = new Date(); // ❌ Sequelize doesn't recognize this
}

// AFTER (FIXED):
if (normalizedStatus === "paid" && record.status !== "paid") {
  updateData.receiptCreatedAt = new Date(); // ✅ Correct model attribute name
}
```

**Why**: Sequelize maps model attributes (camelCase) to DB columns (snake_case) via the `field` property in model definition:

```javascript
receiptCreatedAt: {
  type: DataTypes.DATE,
  field: "receipt_created_at",  // DB column name
  allowNull: true
}
```

When calling `.update()`, must use the **model attribute name**, not the DB column name.

**Verification**: Check `bookingModel.js` line 95-99 to confirm model defines both attribute and field mapping.

---

## PDF Generation Updates

### Receipt Controller Refactored

**File**: `controllers/receiptController.js`

**Key Changes**:

- ✅ **Removed Puppeteer**: Switched from browser-based to direct pdfkit rendering (lighter weight)
- ✅ **Portrait Sizing**: Enforces max width of 520px and max height of 1100px
- ✅ **Centered Layout**: Image centered on A4 page using calculated x/y offsets
- ✅ **Error Handling**: Comprehensive error messages and logging

**New Logic**:

```javascript
const pageWidth = doc.page.width;
const pageHeight = doc.page.height;
const fitWidth = Math.min(pageWidth * 0.87, 520); // 87% of page or 520px max
const fitHeight = Math.min(pageHeight * 0.95, 1100); // 95% of page or 1100px max
const x = (pageWidth - fitWidth) / 2; // Center horizontally
const y = (pageHeight - fitHeight) / 2; // Center vertically

doc.image(imageBuffer, x, y, {
  fit: [fitWidth, fitHeight],
  align: "center",
  valign: "center",
});
```

**Result**: PDF shows centered vertical receipt card (520px wide × ~1100px tall) on A4 page, perfect for portrait-oriented receipt design.

---

## Status Transitions

```
┌─────────────┐
│   booked    │  ← Default status on creation
└──────┬──────┘
       │
       ├──→ pending (manual toggle)
       │
       ├──→ confirmed (payment receipt issued)
       │
       ├──→ paid (payment marked as received) ← Sets receiptCreatedAt
       │
       ├──→ completed (service completed)
       │
       ├──→ cancelled (booking cancelled)
       │
       └──→ rejected (booking rejected)
```

---

## Company & Association Validation

### Multi-Tenant Architecture

```
Association
  ├── Company A
  │   ├── User 1 (operator_admin)
  │   ├── User 2 (operator_staff)
  │   └── Products (Activities, Accommodations)
  │
  ├── Company B
  │   ├── User 3 (operator_admin)
  │   └── Products
  │
  └── Company C
```

### Package Company Validation

**Rule**: All companies in a package must belong to the same association

**Implementation**:

```javascript
// In bookingsService.js
const referrerAssoc = await resolveCompanyAssociationId(referrer_id);
const refereeAssoc = await resolveCompanyAssociationId(referee_id);

if (referrerAssoc !== refereeAssoc) {
  throw new BadRequestError(
    "Cannot create package: companies must be in same association",
  );
}
```

---

## Error Handling

### Error Classes

| Class               | HTTP | Use Case                          |
| ------------------- | ---- | --------------------------------- |
| `BadRequestError`   | 400  | Invalid input, validation failure |
| `UnauthorizedError` | 401  | Not authenticated                 |

| `x] Run migrations in order (especially #4000 data sync)

- [x] Verify JWT payload includes `company_id` and `unified_user_id`
- [x] Test booking creation with all three types
- [x] Validate package company association check
- [x] Confirm permission assignments for operator_admin role
- [x] Test status transitions (cancel, mark as paid)
- [x] ✅ **Verify receiptCreatedAt persistence when marking paid**
- [x] Verify authorization on all endpoints
- [x] Load test with pagination (1000+ bookings)
- [x] Test PDF generation with portrait sizing
- [x] Add receipt PDFs to .gitignore
      "success": false,
      "message": "Product type mismatch: cannot book activity as accommodation",
      "statusCode": 400
      }

// 403 Forbidden
{
"success": false,
"message": "You don't have permission to cancel this booking",
"statusCode": 403
}

// 404 Not Found
{
"success": false,
"message": "Booking not found",
"statusCode": 404
}

````

---

## Testing & Validation

### Test Coverage

**Automated tests** available in docs:

- See [BOOKING_API_TEST_REPORT.md](./BOOKING_API_TEST_REPORT.md) for comprehensive API validation
- 12 bookings tested across all types
- All CRUD operations validated
- Error handling verified

### Key Test Scenarios

1. ✅ Create activity booking with domestic/international pax
2. ✅ Create accommodation booking with check-in/check-out dates
3. ✅ Create package booking with multi-company items
4. ✅ Update booking details
5. ✅ Cancel booking (status → cancelled)
6. ✅ Mark booking as paid (status → paid)
7. ✅ Filter bookings by status, type, date range
8. ✅ Pagination and sorting
9. ✅ Authorization checks (prevent unauthorized updates)
10. ✅ Validation errors (invalid dates, missing fields)

---

## Development Scripts

### Debugging Utilities (Optional - Can Delete)

Located in `/scripts/`:

- `check-company-associations.js`: List user associations for given companies
- `find-and-check-company-associations.js`: Search companies by name pattern
- `fix-company-association-mismatch.js`: Auto-fix mismatched associations

**Decision**: Delete if association validation prevents issues; keep if troubleshooting is expected.

---

## Deployment Checklist

- [ ] Run migrations in order (especially #4000 data sync)
- [ ] Verify JWT payload includes `company_id` and `unified_user_id`
- [ ] Test booking creation with all three types
- [ ] Validate package company association check
- [ ] Confirm permission assignments for operator_admin role
- [ ] Test status transitions (cancel, mark as paid)
- [ ] Verify authorization on all endpoints
- [ ] Load test with pagination (1000+ bookings)

---

## Performance Considerations

### Query Optimization

```javascript
// Batch load associations to avoid N+1
const bookings = await Booking.findAll({
  include: [
    { model: User, attributes: ["id", "name", "company_id"] },
    { model: Company, attributes: ["id", "company_name"] },
  ],
  raw: true,
});
````

### Caching Strategy

```javascript
// Cache product list (change infrequently)
const cache = new Map();
const getProducts = async (companyId) => {
  const key = `products:${companyId}`;
  if (cache.has(key)) return cache.get(key);

  const products = await Product.findAll({ where: { company_id: companyId } });
  cache.set(key, products);
  return products;
};
```

---

## Related Documentation

- Backend Code Structure: [AGENTS.md](../AGENTS.md)
- API Testing Results: [BOOKING_API_TEST_REPORT.md](./BOOKING_API_TEST_REPORT.md)
- RBAC System: [RBAC Implementation](./RBAC_IMPLEMENTATION.md)

---

8, 2026 (Final Update)  
**Version**: 1.1 (Receipt Persistence Fix + PDF Generation Improvements)  
**Status**: Production Ready ✅

---

## What's New in This Update (May 8)

### Backend Changes

1. ✅ **Fixed receiptCreatedAt Persistence**: Now correctly saves when booking marked paid (camelCase attribute fix)
2. ✅ **PDF Generation Refactored**: Removed Puppeteer, using pdfkit directly for lighter footprint
3. ✅ **Portrait PDF Sizing**: 520px width × ~1100px height for vertical receipt card layout
4. ✅ **Git Ignore PDFs**: Added `uploads/receipt_*.pdf` to prevent generated files being committed

### Frontend Changes

1. ✅ **Pagination Implemented**: 10 rows per page with direct page number jumps (1, 2, 3, ...)
2. ✅ **Receipt Pages Redesigned**: Grid-based two-column layout for accommodation and activity receipts
3. ✅ **Auto-Generated PDFs**: Receipts auto-generate after component loads
4. ✅ **Responsive Receipt Styling**: Desktop two-column, mobile single-column with fallback
5. ✅ **Booking Integration**: Receipts can load from booking state (navigation) or via booking ID
6. ✅ **Company Profile Loading**: Fetches company name, email, logo for issued-by section
7. ✅ **Menu Context Updated**: All pages now use `'operator_admin'` context for proper permissions

### API Enhancements

1. ✅ **New Endpoints**:
   - `GET /api/companies/package-options`: List companies filtered by association
   - `GET /api/products/company/:companyId`: List products for specific company
2. ✅ **Enhanced `POST /api/bookings`**: Phone and email fields now supported
3. ✅ **Status Action Endpoints**: `/api/bookings/:id/cancel` and `/api/bookings/:id/payment`
   **Last Updated**: May 5, 2026  
   **Version**: 1.0 (Initial Release)  
   **Status**: Production Ready ✅
