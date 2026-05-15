# Backend Technical Documentation: Offline-First Booking Strategy

**Feature**: Offline-First Booking Module with Sync Queue  
**Version**: 1.0  
**Date**: May 8, 2026  
**Author**: Development Team

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Phase 1: Database Schema Changes](#phase-1-database-schema-changes)
4. [Phase 2: Idempotency Layer](#phase-2-idempotency-layer)
5. [Phase 3: Conflict Detection (Version Control)](#phase-3-conflict-detection-version-control)
6. [Phase 4: Error Classes](#phase-4-error-classes)
7. [Phase 5: Controller Updates](#phase-5-controller-updates)
8. [Phase 6: Receipt Module (Offline Read)](#phase-6-receipt-module-offline-read)
9. [Phase 7: Login Response — company_location](#phase-7-login-response--company_location)
10. [Negative Scenario Handling](#negative-scenario-handling)
11. [API Contract](#api-contract)
12. [Testing & Validation](#testing--validation)
13. [Deployment Guide](#deployment-guide)

---

## Overview

### Problem Statement

Operator admins create and edit booking data on-site. Internet connectivity is unreliable in rural tourism environments. Without offline support, operators are completely blocked from creating or editing bookings during connectivity loss.

### Solution

**Online-first with Offline Capability**:

- Server remains the authoritative source of truth
- Frontend maintains a local sync queue (IndexedDB) for pending operations
- Backend is hardened to handle retries, duplicates, and conflicts safely
- Conflicts are surfaced to the operator — never silently discarded

### Scope

- **Offline operations**: CREATE booking, EDIT booking
- **Online-only operations**: Delete booking, status changes, PDF generation
- **Backend role**: Accept idempotency keys, detect version conflicts, return structured conflict responses

### Guiding Principles

| Principle                       | Implementation                                             |
| ------------------------------- | ---------------------------------------------------------- |
| Server is authoritative         | All final state lives on server                            |
| Retries must be safe            | Idempotency keys prevent duplicate records                 |
| No silent data loss             | Conflicts return 409 with full context                     |
| Fail loudly, recover gracefully | Structured error responses enable smart frontend decisions |

---

## Architecture

### System Flow — Create Booking (Offline-Capable)

```
══════════════════════════════════════════════════════════════════════════════════
  FRONTEND (Ionic/Angular)                   BACKEND (Node.js/Express)
══════════════════════════════════════════════════════════════════════════════════

  ┌─────────────────────────┐
  │  Operator fills form    │
  │  UUID generated on mount│
  └──────────┬──────────────┘
             │
             ▼
  ┌─────────────────────────┐
  │  Write to IndexedDB     │
  │  queue (status:pending) │
  └──────────┬──────────────┘
             │
     Online? │
    ┌────────┴────────┐
    │YES              │NO
    ▼                 ▼
  Sync Worker     Show "Saved
  triggers        Locally" toast.
  immediately     Wait for network.
    │
    ▼
  POST /api/bookings
  { ...bookingData,
    idempotency_key: "uuid-v4" }
    │
    │              ┌─────────────────────────────────────────┐
    │              │  bookingsService.createBooking()         │
    │              │                                         │
    │              │  1. Check idempotency_key in DB         │
    │              │     - FOUND → return existing record    │
    │              │     - NOT FOUND → create new booking    │
    │              │  2. Increment version = 0 (new record)  │
    │              │  3. Return booking data                 │
    │              └─────────────────────────────────────────┘
    │
    ▼
  200 OK → mark queue item "synced"
  500/timeout → keep "pending", retry
  4xx validation → mark "permanently_failed"


══════════════════════════════════════════════════════════════════════════════════

### System Flow — Edit Booking (Offline-Capable, Version-Controlled)

  ┌─────────────────────────┐
  │  Operator opens booking │
  │  Captures: id, version  │
  └──────────┬──────────────┘
             │
             ▼
  ┌─────────────────────────┐
  │  Write EDIT to queue    │
  │  { id, base_version,    │
  │    idempotency_key,     │
  │    payload }            │
  └──────────┬──────────────┘
             │
    Online? Sync Worker triggers
             │
             ▼
  PUT /api/bookings/:id
  { ...updatedFields,
    base_version: 3,
    idempotency_key: "uuid-v4" }
    │
    │              ┌─────────────────────────────────────────┐
    │              │  bookingsService.updateBooking()         │
    │              │                                         │
    │              │  1. Load booking from DB                │
    │              │  2. Check idempotency_key               │
    │              │     - FOUND (same key) → already done,  │
    │              │       return existing record            │
    │              │  3. Check version:                      │
    │              │     - booking.version === base_version  │
    │              │       → apply update, increment version │
    │              │     - booking.version > base_version    │
    │              │       → throw ConflictError(409)        │
    │              └─────────────────────────────────────────┘
    │
    ▼
  200 OK → mark "synced"
  409 Conflict → mark "conflict", show operator diff UI
  404 Not Found → mark "conflict" (deleted on server), offer recreate
```

---

## Phase 1: Database Schema Changes

### 1.1 Migration: Add `idempotency_key` and `version` to Bookings

**File**: `migrations/YYYYMMDDHHMMSS-add-offline-sync-fields-to-bookings.js`

```javascript
"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("bookings", "idempotency_key", {
      type: Sequelize.STRING(36),
      allowNull: true,
      defaultValue: null,
      after: "id",
    });

    await queryInterface.addColumn("bookings", "version", {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
      after: "idempotency_key",
    });

    // Unique index: prevents duplicate processing of same client operation
    await queryInterface.addIndex("bookings", ["idempotency_key"], {
      unique: true,
      name: "bookings_idempotency_key_unique",
      where: {
        idempotency_key: { [Sequelize.Op.ne]: null },
      },
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex(
      "bookings",
      "bookings_idempotency_key_unique",
    );
    await queryInterface.removeColumn("bookings", "version");
    await queryInterface.removeColumn("bookings", "idempotency_key");
  },
};
```

### 1.2 Model Update

**File**: `models/bookingModel.js`

Add these fields to the model definition:

```javascript
idempotency_key: {
  type: DataTypes.STRING(36),
  allowNull: true,
  defaultValue: null,
},
version: {
  type: DataTypes.INTEGER,
  allowNull: false,
  defaultValue: 0,
},
```

---

## Phase 2: Idempotency Layer

### 2.1 Create Booking with Idempotency Check

**File**: `services/bookingsService.js`

`BookingsService` is a class. The additions below are inserted into the **existing** `createBooking(data, authUser)` method, immediately before `Booking.create()` is called:

```javascript
async createBooking(data, authUser) {
  const packageCompaniesRaw = Array.isArray(data.package_companies)
    ? data.package_companies
    : [];

  const transaction = await Booking.sequelize.transaction();
  try {
    const operatorContext = await this.resolveOperatorContext(authUser, transaction);
    const payload = this.buildCreatePayload(data, operatorContext);

    // ── ADD: Idempotency check (before Booking.create) ─────────────
    const idempotencyKey = normalizeString(data.idempotency_key) || null;
    if (idempotencyKey) {
      const existing = await Booking.findOne({
        where: { idempotencyKey },
        include: [{ model: BookingPackageCompany, as: "package_companies", required: false }],
        transaction,
      });
      if (existing) {
        await transaction.commit();
        return this.serialize(existing); // idempotent: return the existing booking as-is
      }
    }
    // ── END ADD ────────────────────────────────────────────────────

    // ... existing package_companies validation ...

    // ── ADD: attach idempotency key and initial version to payload ─
    payload.idempotencyKey = idempotencyKey;
    payload.version = 0;
    // ── END ADD ────────────────────────────────────────────────────

    const created = await Booking.create(payload, { transaction });
    // ... rest of existing code unchanged ...
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}
```

### 2.2 Update Booking with Idempotency + Version Check

The additions below are inserted into the **existing** `updateBooking(id, data)` method, immediately **after** `Booking.findByPk()` and **before** `buildUpdatePayload()` is called:

```javascript
async updateBooking(id, data) {
  // ... existing: bookingId normalisation + transaction + findByPk ...

  // ── ADD: extract offline sync fields ─────────────────────────────
  const idempotencyKey = normalizeString(data.idempotency_key) || null;
  const baseVersion =
    data.base_version !== undefined
      ? normalizeInt(data.base_version, null)
      : null;

  // Idempotency: same key = this exact edit was already applied on this record
  if (idempotencyKey && record.idempotencyKey === idempotencyKey) {
    await transaction.commit();
    return this.serialize(record);
  }

  // Version conflict: another user edited between the client's read and this write
  if (baseVersion !== null && record.version !== baseVersion) {
    const { ConflictError } = require("../errors/AppError");
    throw new ConflictError(
      "Booking was modified by another user while you were offline",
      { serverVersion: record.version, serverData: this.serialize(record) },
    );
  }
  // ── END ADD ──────────────────────────────────────────────────────

  const payload = this.buildUpdatePayload(data);

  // ... existing draft + type-specific validation logic ...

  // ── ADD: increment version and stamp idempotency key ─────────────
  payload.version = record.version + 1;
  if (idempotencyKey) payload.idempotencyKey = idempotencyKey;
  // ── END ADD ──────────────────────────────────────────────────────

  await record.update(payload, { transaction });
  // ... rest of existing code unchanged ...
}
```

> **Key insight**: Storing `idempotencyKey` on the record after a successful update means the next retry with the same key returns the already-updated record — not an error.

---

## Phase 3: Conflict Detection (Version Control)

### 3.1 How Versioning Works

| Event                                                     | `version` value    |
| --------------------------------------------------------- | ------------------ |
| Booking created                                           | `0`                |
| First edit applied                                        | `1`                |
| Second edit applied                                       | `2`                |
| Offline client has `base_version: 1` but server is at `2` | **Conflict → 409** |

### 3.2 Conflict Response Shape

When a version conflict is detected, the server returns:

```json
HTTP 409 Conflict

{
  "success": false,
  "message": "Booking was modified by another user while you were offline",
  "conflict": true,
  "serverVersion": 2,
  "serverData": {
    "id": 123,
    "tourist_full_name": "Ahmad bin Razak",
    "status": "confirmed",
    "total_price": "450.00",
    "version": 2,
    ...
  }
}
```

The frontend uses `serverData` to show the operator what changed, enabling a side-by-side conflict resolution UI.

### 3.3 Conflict Resolution Options (frontend-driven)

| Option                | Frontend Action                                                             | Backend Effect                             |
| --------------------- | --------------------------------------------------------------------------- | ------------------------------------------ |
| Accept server version | Discard local edit, update local cache                                      | None                                       |
| Force local version   | Generate new `idempotency_key`, resubmit with `base_version: serverVersion` | Applies edit on top of latest server state |

---

## Phase 4: Error Classes

**File**: `services/errors/AppError.js`

`ConflictError` **already exists** in the codebase. Update its constructor to accept a `meta` object so that conflict details (`serverVersion` and `serverData`) are forwarded to the client via `errorResponse()`:

```javascript
// CHANGE: add meta parameter to the existing ConflictError constructor
class ConflictError extends AppError {
  constructor(message = "Resource already exists", meta = {}) {
    super(message, 409, "CONFLICT");
    this.name = "ConflictError";
    this.meta = meta; // { serverVersion: number, serverData: object }
  }
}

// module.exports already includes ConflictError — no change needed there.
```

---

## Phase 5: Controller Updates

**File**: `controllers/bookingController.js`

### 5.1 Create Booking Controller

Minimal change: detect whether the service performed a real insert (201) or returned an existing record via idempotency (200). The service now serialises internally so no `serialize()` call is needed in the controller.

```javascript
// controllers/bookingController.js — createBooking
exports.createBooking = async (req, res) => {
  try {
    const validationResult = bookingValidator.validateCreate(req.body);
    if (!validationResult.isValid) {
      return errorResponse(
        res,
        validationResult.message || "Validation failed",
        400,
        validationResult.errors,
      );
    }

    const booking = await bookingsService.createBooking(req.body, req.user);

    // Detect idempotent return: if the client's key is already on the record,
    // the service resolved to an existing booking rather than creating a new one.
    const clientKey = req.body.idempotency_key;
    const isIdempotent = clientKey && booking.idempotency_key === clientKey;
    const statusCode = isIdempotent ? 200 : 201;
    const message = isIdempotent
      ? "Booking already exists (idempotent)"
      : "Booking created successfully";

    return successResponse(res, booking, message, statusCode);
  } catch (error) {
    return errorResponse(res, error);
  }
};
```

### 5.2 Update Booking Controller

No structural changes. `ConflictError` thrown by the service carries `statusCode = 409` and `meta = { serverVersion, serverData }`. `errorResponse()` spreads `err.meta` into the response body automatically (see Phase 5.3), so the controller needs no special conflict handling.

```javascript
// controllers/bookingController.js — updateBooking
exports.updateBooking = async (req, res) => {
  try {
    const validationResult = bookingValidator.validateUpdate(req.body);
    if (!validationResult.isValid) {
      return errorResponse(
        res,
        validationResult.message || "Validation failed",
        400,
        validationResult.errors,
      );
    }

    const existing = await bookingsService.getBookingById(req.params.id);
    if (!policy("booking", req.user, existing).update()) {
      throw new ForbiddenError(
        "You do not have permission to update this booking",
      );
    }

    const booking = await bookingsService.updateBooking(
      req.params.id,
      req.body,
    );

    return successResponse(res, booking, "Booking updated successfully");
  } catch (error) {
    // ConflictError → 409 with serverVersion + serverData in body.
    return errorResponse(res, error);
  }
};
```

### 5.3 `errorResponse` Meta Support

The existing `errorResponse` in `utils/helpers.js` already handles `err.details` for validation errors. Add one line to also spread `err.meta` for conflict responses:

```javascript
// utils/helpers.js — inside the `instanceof Error` branch of errorResponse
const errorResponse = (res, messageOrError, statusCode, errors) => {
  if (messageOrError instanceof Error) {
    const err = messageOrError;
    const body = {
      success: false,
      message: err.message || "Internal server error",
    };
    if (err.details) body.errors = err.details; // existing — validation error array

    // ── ADD: surface conflict meta (serverVersion, serverData) ─────
    if (err.meta) Object.assign(body, err.meta);
    // ── END ADD ────────────────────────────────────────────────────

    return res.status(err.statusCode || 500).json(body);
  }
  // ... existing positional-args branch unchanged ...
};
```

---

## Phase 6: Receipt Module (Offline Read)

### 6.1 Scope

| Operation                              | Offline support                     |
| -------------------------------------- | ----------------------------------- |
| View booking details (receipt)         | ✅ via frontend `booking_cache`     |
| Download PDF (`GET /bookings/:id/pdf`) | ❌ server-side render — online only |

The backend requires **no code changes** for offline receipt reading. The existing `GET /api/bookings/:id` endpoint already returns the full booking object required to render a booking confirmation. The frontend caches this payload in IndexedDB (`booking_cache`) on every successful load; see Frontend doc Phase 7 for the implementation.

### 6.2 PDF Endpoint Stays Online-Only

`GET /api/bookings/:id/pdf` performs server-side PDF generation and must remain online-only. The route is already protected by `authenticate` + `authorize("booking:read")`; no changes are needed.

When the frontend is offline and the operator taps "Download PDF", the UI must show:

> "PDF download requires an internet connection. Please reconnect and try again."

This message is a **frontend responsibility** — no backend change required.

### 6.3 Data Freshness After Sync

After the SyncService processes the offline queue, it should refresh the `booking_cache` by re-fetching the affected bookings from `GET /api/bookings`. This ensures the cached receipt reflects any server-side status changes (e.g., `pending` → `confirmed`) that may have occurred while the operator was offline.

The `GET /api/bookings` response already contains all fields needed for a receipt snapshot. No new endpoints are required.

### 6.4 Booking List Cache (Online Load)

Every successful response from `GET /api/bookings` (booking list) and `GET /api/bookings/:id` (single booking) should be written to `booking_cache` on the frontend. This gives the operator a full offline receipt view for any booking they have previously loaded. See Frontend doc Phase 7 for the `OfflineQueueService.cacheBookings()` call sites.

---

## Phase 7: Login Response — company_location

### 7.1 Problem Solved

Receipt pages (`receipt-activity`, `receipt`, `receipt-package`) display the operator's company location. Previously this required a separate API call to fetch the company profile. When offline, that call fails and the location field was left blank.

### 7.2 Change: `loginFromUnifiedUsers()` in `services/authService.js`

The `loginFromUnifiedUsers()` function now includes `company_location` in the login response data object, alongside the existing `company_name` and `company_email` fields:

```javascript
// In the user data object returned by loginFromUnifiedUsers():
company_name: companyName,
company_email: companyEmail,
company_location: companyLocation,  // ← added
role: { ... }
```

`companyLocation` is resolved from the operator's associated company record at login time, using the same pattern already in place for `companyName` and `companyEmail`.

### 7.3 Frontend Usage

Receipt pages read `cachedUser?.company_location` from `localStorage.getItem('user')` as a fallback in the `companyLocation` getter:

```typescript
get companyLocation(): string {
  // Primary: fetch from company profile API (online)
  if (this.companyProfile?.location) return this.companyProfile.location;
  // Fallback: use value cached at login time (offline)
  const cachedUser = JSON.parse(localStorage.getItem('user') ?? '{}');
  return cachedUser?.company_location ?? '';
}
```

This means the company location is always available on receipt pages, even when the company profile API cannot be reached offline.

### 7.4 Why This Belongs in the Login Response

The company location is a stable, rarely-changing piece of data. Embedding it in the login response — which is already persisted to localStorage — is the most efficient way to make it available offline without adding a separate caching mechanism.

---

## Negative Scenario Handling

### Summary Table

| #   | Scenario                                | Prevention                                    | Mitigation                                   |
| --- | --------------------------------------- | --------------------------------------------- | -------------------------------------------- |
| 1   | Duplicate submission                    | Unique index on `idempotency_key`             | Return existing record (200), no error       |
| 2   | Two operators edit same booking         | `version` field + base_version check          | 409 with `serverData` for conflict UI        |
| 4   | Partial sync (some fail)                | Per-item queue status (independent)           | Frontend retries only failed items           |
| 5   | Network drops mid-request               | Idempotency makes retries safe                | Frontend retries; server deduplicates        |
| 6   | Edit offline, booking deleted on server | Cache refresh on reconnect                    | Server returns 404; frontend offers recreate |
| 9   | Infinite retry loop                     | Exponential backoff on frontend               | 4xx never retried; max 3 retries for 5xx     |
| 10  | Out-of-order sync                       | Queue ordered per booking (frontend)          | Backend processes each as independent        |
| 15  | Silent failures                         | Structured error responses                    | Frontend shows persistent failure badge      |
| 16  | OS kills app mid-sync                   | Idempotency key; server deduplicates re-sends | Re-sent request returns 200 if already done  |
| 17  | Duplicate queue entries                 | Frontend prevents; unique index is safety net | DB rejects with unique constraint error      |

### Detailed: Scenario #2 (Most Complex)

**Two operators (Operator A offline, Operator B online) editing booking #123**

```
Timeline:
  T1: Booking #123 created → version: 0
  T2: Operator A goes offline, captures version: 0
  T3: Operator B edits online → version becomes 1
  T4: Operator A regains connection, syncs edit with base_version: 0
  T5: Server detects: current_version(1) > base_version(0) → 409

Server response:
  {
    "conflict": true,
    "serverVersion": 1,
    "serverData": { ...operator B's version... }
  }

Frontend behavior:
  - Queue item marked "conflict"
  - Operator A sees: "Booking updated by another user"
  - Shows diff of changed fields
  - Options: "Use server version" or "Override with my changes"
```

**Scenario #6 (Edit after server deletion)**

```
Timeline:
  T1: Booking #456 exists on server
  T2: Operator A goes offline, booking is in local cache
  T3: Manager deletes booking #456 on server
  T4: Operator A edits booking #456 offline
  T5: Operator A reconnects, sync sends PUT /api/bookings/456

Server response:
  HTTP 404 Not Found
  { "message": "Booking not found" }

Frontend behavior:
  - Queue item marked "conflict"
  - Operator A sees: "Booking was deleted on the server"
  - Option: "Create as new booking" (prefills form with offline data)
```

---

## API Contract

### POST `/api/auth/login` — Login

**Response additions**:

The login response user data object now includes `company_location` alongside existing fields. This value is persisted to localStorage on the frontend and used as a fallback when the company profile API is unreachable offline.

```json
{
  "success": true,
  "data": {
    "token": "...",
    "user": {
      "id": 1,
      "name": "Ahmad Operator",
      "company_id": 5,
      "company_name": "Sabah Eco Tours",
      "company_email": "info@sabaheco.com",
      "company_location": "Kota Kinabalu, Sabah",
      "role": { ... }
    }
  }
}
```

---

### POST `/api/bookings` — Create Booking

**Request additions for offline support**:

```json
{
  "booking_type": "activity",
  "tourist_full_name": "Ahmad bin Razak",
  "idempotency_key": "550e8400-e29b-41d4-a716-446655440000",
  "..."
}
```

**Responses**:

| Status             | Meaning                                   |
| ------------------ | ----------------------------------------- |
| `201 Created`      | New booking created                       |
| `200 OK`           | Booking already exists (idempotent retry) |
| `400 Bad Request`  | Validation failed                         |
| `401 Unauthorized` | Token missing/invalid                     |
| `403 Forbidden`    | Insufficient permissions                  |

---

### PUT `/api/bookings/:id` — Update Booking

**Request additions for offline support**:

```json
{
  "tourist_full_name": "Ahmad bin Razak",
  "base_version": 3,
  "idempotency_key": "660e9500-f30c-52e5-b827-557766551111",
  "..."
}
```

**Responses**:

| Status          | Meaning                                                                 |
| --------------- | ----------------------------------------------------------------------- |
| `200 OK`        | Booking updated                                                         |
| `200 OK`        | Already updated (idempotent retry — same `idempotency_key`)             |
| `409 Conflict`  | Version mismatch — `conflict: true, serverVersion, serverData` returned |
| `404 Not Found` | Booking was deleted on server                                           |
| `403 Forbidden` | Insufficient permissions                                                |

---

## Testing & Validation

### Unit Tests

**Test 1 — Idempotency on Create**

```javascript
it("returns existing booking when idempotency_key already exists", async () => {
  const key = "test-uuid-001";
  await createBooking({ ...payload, idempotency_key: key }, operatorCtx);
  const { booking, created } = await createBooking(
    { ...payload, idempotency_key: key },
    operatorCtx,
  );

  expect(created).toBe(false);
  expect(await Booking.count({ where: { idempotency_key: key } })).toBe(1);
});
```

**Test 2 — Version Conflict on Update**

```javascript
it("throws ConflictError when base_version is stale", async () => {
  const booking = await createBooking({ ...payload }, operatorCtx);
  await updateBooking(
    booking.id,
    { tourist_full_name: "New Name", base_version: 0 },
    userCtx,
  );

  await expect(
    updateBooking(
      booking.id,
      { tourist_full_name: "Old Name", base_version: 0 },
      userCtx,
    ),
  ).rejects.toThrow(ConflictError);
});
```

**Test 3 — Idempotency on Update (retry)**

```javascript
it("returns already-updated booking on duplicate edit key", async () => {
  const key = "edit-uuid-002";
  await updateBooking(
    booking.id,
    { tourist_full_name: "Name A", idempotency_key: key, base_version: 0 },
    userCtx,
  );
  const { updated } = await updateBooking(
    booking.id,
    { tourist_full_name: "Name B", idempotency_key: key, base_version: 0 },
    userCtx,
  );

  expect(updated).toBe(false);
  expect(booking.tourist_full_name).toBe("Name A"); // first write preserved
});
```

**Test 4 — 404 on edit of deleted booking**

```javascript
it("throws NotFoundError when booking does not exist", async () => {
  await expect(
    updateBooking(
      9999999,
      { tourist_full_name: "X", base_version: 0 },
      userCtx,
    ),
  ).rejects.toThrow(NotFoundError);
});
```

**Test 5 — Partial success doesn't cascade**

```javascript
it("valid bookings are not affected by unrelated failed booking", async () => {
  // Create 3 valid bookings + 1 invalid
  const validResults = await Promise.allSettled([
    createBooking(validPayload1, operatorCtx),
    createBooking(invalidPayload, operatorCtx), // will fail validation
    createBooking(validPayload2, operatorCtx),
  ]);

  expect(validResults[0].status).toBe("fulfilled");
  expect(validResults[1].status).toBe("rejected");
  expect(validResults[2].status).toBe("fulfilled");
});
```

**Test 6 — company_location in login response**

```javascript
it("includes company_location in login response for operator users", async () => {
  const response = await loginFromUnifiedUsers(operatorCredentials);
  expect(response.user).toHaveProperty("company_location");
  expect(typeof response.user.company_location).toBe("string");
});
```

### Integration Tests

```bash
# Run booking-specific tests
npx jest tests/bookings --verbose

# Run with coverage
npx jest tests/bookings --coverage
```

### Manual Validation Checklist

- [ ] POST booking twice with same `idempotency_key` → only 1 record in DB
- [ ] PUT booking with `base_version: 0` after another edit (version is 1) → 409 response
- [ ] PUT booking that was deleted → 404 response
- [ ] Check DB: `bookings` table has `idempotency_key` and `version` columns
- [ ] Check DB: unique index `bookings_idempotency_key_unique` exists
- [ ] POST `/api/auth/login` → response includes `company_location` in user object

---

## Deployment Guide

### Step 1: Run Migration

```bash
cd rural-tourism-backend
npx sequelize-cli db:migrate
```

Verify:

```sql
DESCRIBE bookings;
-- Should show idempotency_key VARCHAR(36) and version INT columns

SHOW INDEX FROM bookings WHERE Key_name = 'bookings_idempotency_key_unique';
-- Should show 1 row
```

### Step 2: Update Model

Update `models/bookingModel.js` to include `idempotency_key` and `version` fields (see Phase 1.2).

### Step 3: Update Services

Update `services/bookingsService.js` with idempotency and version logic (see Phase 2).

Update `services/authService.js` to include `company_location` in the login response (see Phase 7).

### Step 4: Update Error Classes

Add `ConflictError` to `services/errors/AppError.js` (see Phase 4).

### Step 5: Update Controllers

Update `controllers/bookingController.js` create and update handlers (see Phase 5).

### Step 6: Update `errorResponse` Helper

Ensure `utils/helpers.js` passes `err.meta` in the response body (see Phase 5.3).

### Step 7: Deploy

```bash
# Standard deployment
npm run build  # if applicable
pm2 restart app
```

### Step 8: Verify Idempotency Behaviour in Production

After deploying, run these smoke checks:

```bash
# 1. POST booking twice with same idempotency_key → should return 200 on second call
curl -X POST /api/bookings -d '{...same body with same idempotency_key...}'

# 2. PUT booking with stale base_version → should return 409
curl -X PUT /api/bookings/1 -d '{...base_version: 0...}'  # if server version is 1

# 3. Verify columns exist
mysql -e "DESCRIBE bookings;"  # should show idempotency_key and version columns

# 4. Verify company_location in login response
curl -X POST /api/auth/login -d '{...operator credentials...}' | jq '.data.user.company_location'
```

### Rollback Plan

If issues arise:

```bash
npx sequelize-cli db:migrate:undo  # removes idempotency_key and version columns
```

The schema change is purely additive — all existing endpoints continue to work unchanged. `idempotency_key` is nullable so existing bookings are unaffected.

To revert the login response change, remove `company_location` from the user data object in `loginFromUnifiedUsers()`. This is a non-breaking change — the frontend falls back gracefully if the field is absent.

---

## Appendix: Field Reference

| Field             | Type        | Nullable | Default | Purpose                                                            |
| ----------------- | ----------- | -------- | ------- | ------------------------------------------------------------------ |
| `idempotency_key` | VARCHAR(36) | YES      | NULL    | UUID v4 from client; prevents duplicate processing                 |
| `version`         | INT         | NO       | 0       | Increments on every server-side update; enables conflict detection |

### idempotency_key Lifecycle

```
[Form mounts]
  → Frontend generates UUID v4
  → Stored on queue item

[Sync: CREATE]
  → Sent as request body field
  → Server stores on booking record
  → Retry: server finds key → returns existing booking (200)

[Sync: EDIT]
  → New UUID v4 generated per edit operation
  → Sent as request body field
  → Server stores on booking record after successful update
  → Retry: server finds key on booking → returns already-updated booking (200)
```

### version Lifecycle

```
[Booking created]         → version = 0
[First online edit]       → version = 1
[Second online edit]      → version = 2
[Offline edit submitted]  → checks base_version matches current version
  - Match    → version = current + 1 (success)
  - Mismatch → 409 Conflict (someone else edited in between)
```
