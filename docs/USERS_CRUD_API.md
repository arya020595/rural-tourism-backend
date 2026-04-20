# Users CRUD API Documentation

> Base URL: `/api/users`

## Table of Contents

- [Authentication](#authentication)
- [Authorization (RBAC)](#authorization-rbac)
- [Endpoints](#endpoints)
  - [List All Users](#list-all-users)
  - [Get User by ID](#get-user-by-id)
  - [Create User](#create-user)
  - [Update User](#update-user)
  - [Delete User](#delete-user)
  - [Search Users](#search-users)
- [Response Format](#response-format)
- [Permission Matrix](#permission-matrix)
- [Error Codes](#error-codes)

---

## Authentication

**All endpoints require a valid JWT token** in the `Authorization` header:

```
Authorization: Bearer <token>
```

Obtain a token via `POST /api/auth/login`:

```json
{
  "identifier": "superadmin_seed",
  "password": "superadmin123",
  "user_type": "operator"
}
```

### Seed Users

| Username           | Password         | Role             | Permissions                |
| ------------------ | ---------------- | ---------------- | -------------------------- |
| `superadmin_seed`  | `superadmin123`  | `superadmin`     | `*:*` (full access)        |
| `operator_seed`    | `operator123`    | `operator_admin` | `user:*`, resources CRUD   |
| `tourist_seed`     | `tourist123`     | `tourist`        | `profile:*`, booking, read |
| `association_seed` | `association123` | `association`    | `profile:*`, assoc, read   |

| Scenario          | Status | Response                               |
| ----------------- | ------ | -------------------------------------- |
| No token provided | `401`  | `"Access denied. No token provided."`  |
| Invalid token     | `401`  | `"Invalid token."`                     |
| Expired token     | `401`  | `"Token expired. Please login again."` |

---

## Authorization (RBAC)

The system uses **Role-Based Access Control** with five roles:

| Role             | Scope                      | Description                                           |
| ---------------- | -------------------------- | ----------------------------------------------------- |
| `superadmin`     | Global                     | Full access to everything (`*:*`)                     |
| `operator_admin` | Company-scoped             | Full CRUD on users + resources within their company   |
| `operator_staff` | Company-scoped (read-only) | Read-only on resources + own profile                  |
| `tourist`        | Self                       | Own profile + bookings + read resources               |
| `association`    | Association-scoped         | Own profile + association management + read resources |

### Permission Codes for Users Module

| Permission       | Description                            |
| ---------------- | -------------------------------------- |
| `user:read`      | List all users, get user by ID, search |
| `user:create`    | Create new users                       |
| `user:update`    | Update any user's data                 |
| `user:delete`    | Delete any user                        |
| `profile:read`   | Read own user profile only             |
| `profile:update` | Update own user profile only           |

### Access Rules

- **`superadmin` role** bypasses all permission checks — full access to every endpoint.
- **Wildcard permission `*:*`** also grants unrestricted access.
- **Ownership check**: Endpoints `GET /:id` and `PUT /:id` apply `authorizeOwnership` — users with only `profile:read` / `profile:update` can access **their own resource** but not others'.
- **Company scoping**: `operator_admin` can only see/manage users within their own `company_id` (enforced by policy).

---

## Endpoints

### List All Users

```
GET /api/users
```

**Auth**: Required  
**Permission**: `user:read`

**Response** `200 OK`:

```json
{
  "success": true,
  "message": "Users fetched successfully",
  "data": [
    {
      "id": 1,
      "name": "John Doe",
      "username": "johndoe",
      "email": "john@example.com",
      "role_id": 2,
      "association_id": null,
      "company_id": null,
      "role": { "id": 2, "name": "operator_admin" },
      "association": null,
      "company": null,
      "created_at": "2026-04-20T00:00:00.000Z",
      "updated_at": "2026-04-20T00:00:00.000Z"
    }
  ]
}
```

---

### Get User by ID

```
GET /api/users/:id
```

**Auth**: Required  
**Permission**: `user:read` OR `profile:read` (own resource only)

**Response** `200 OK`:

```json
{
  "success": true,
  "message": "User fetched successfully",
  "data": {
    "id": 1,
    "name": "John Doe",
    "username": "johndoe",
    "email": "john@example.com",
    "role_id": 2,
    "association_id": null,
    "company_id": null,
    "role": { "id": 2, "name": "operator_admin" },
    "association": null,
    "company": null,
    "created_at": "2026-04-20T00:00:00.000Z",
    "updated_at": "2026-04-20T00:00:00.000Z"
  }
}
```

**Error** `404`:

```json
{
  "success": false,
  "message": "User not found"
}
```

---

### Create User

```
POST /api/users
```

**Auth**: Required  
**Permission**: `user:create`

> **Auto-assign behavior**: When an `operator_admin` creates a user, the new user is automatically assigned the `operator_staff` role and the caller's `company_id`. Only `superadmin` can freely assign any `role_id`, `company_id`, or `association_id`.

**Request Body**:

| Field            | Type     | Required | Description                                            |
| ---------------- | -------- | -------- | ------------------------------------------------------ |
| `name`           | `string` | Yes      | Full name                                              |
| `username`       | `string` | Yes      | Unique username                                        |
| `email`          | `string` | Yes      | Unique email                                           |
| `password`       | `string` | Yes      | Plain-text password                                    |
| `role_id`        | `int`    | No       | Role ID (superadmin only — ignored for operator_admin) |
| `association_id` | `int`    | No       | Association FK (superadmin only)                       |
| `company_id`     | `int`    | No       | Company FK (superadmin only)                           |

**Example (operator_admin creating staff)**:

```json
{
  "name": "New Staff Member",
  "username": "new_staff",
  "email": "staff@example.com",
  "password": "secure123"
}
```

_The `role_id` and `company_id` are auto-assigned from the caller's JWT._

**Example (superadmin creating any user)**:

```json
{
  "name": "John Doe",
  "username": "johndoe",
  "email": "john@example.com",
  "password": "secure123",
  "role_id": 2
}
```

**Response** `201 Created`:

```json
{
  "success": true,
  "message": "User created successfully",
  "data": { ... }
}
```

**Errors**:

| Status | Message                                              |
| ------ | ---------------------------------------------------- |
| `400`  | `"name, username, email, and password are required"` |
| `400`  | `"Invalid role_id"`                                  |
| `409`  | `"Username or email already exists"`                 |

---

### Update User

```
PUT /api/users/:id
```

**Auth**: Required  
**Permission**: `user:update` OR `profile:update` (own resource only)

**Request Body** (all fields optional):

| Field            | Type     | Description    |
| ---------------- | -------- | -------------- |
| `name`           | `string` | Full name      |
| `username`       | `string` | Must be unique |
| `email`          | `string` | Must be unique |
| `password`       | `string` | New password   |
| `role_id`        | `int`    | Role ID        |
| `association_id` | `int`    | Association FK |
| `company_id`     | `int`    | Company FK     |

**Example**:

```json
{
  "name": "John Updated",
  "email": "john.updated@example.com"
}
```

**Response** `200 OK`:

```json
{
  "success": true,
  "message": "User updated successfully",
  "data": { ... }
}
```

**Errors**:

| Status | Message                    |
| ------ | -------------------------- |
| `404`  | `"User not found"`         |
| `409`  | `"Username already taken"` |
| `409`  | `"Email already taken"`    |
| `400`  | `"Invalid role_id"`        |

---

### Delete User

```
DELETE /api/users/:id
```

**Auth**: Required  
**Permission**: `user:delete`

**Response** `200 OK`:

```json
{
  "success": true,
  "message": "User deleted successfully"
}
```

**Error** `404`:

```json
{
  "success": false,
  "message": "User not found"
}
```

---

### Search Users

```
GET /api/users/search?name=<query>
```

**Auth**: Required  
**Permission**: `user:read`

**Query Parameters**:

| Param  | Type     | Description                    |
| ------ | -------- | ------------------------------ |
| `name` | `string` | Partial match (SQL `LIKE %q%`) |

**Response** `200 OK`:

```json
{
  "success": true,
  "message": "Search results fetched successfully",
  "data": [ ... ]
}
```

---

## Response Format

All responses follow a consistent envelope:

### Success

```json
{
  "success": true,
  "message": "Human-readable message",
  "data": { ... }
}
```

### Error

```json
{
  "success": false,
  "message": "Error description"
}
```

### Authorization Error (403)

```json
{
  "success": false,
  "message": "Forbidden. You do not have permission to perform this action.",
  "data": {
    "required": ["user:read"],
    "your_role": "operator"
  }
}
```

---

## Permission Matrix

| Endpoint                | Admin | `user:read` | `user:update` | `user:delete` | `profile:read` | `profile:update` | No Perms  |
| ----------------------- | ----- | ----------- | ------------- | ------------- | -------------- | ---------------- | --------- |
| `GET /api/users`        | ✅    | ✅          | ❌            | ❌            | ❌             | ❌               | ❌ 403    |
| `GET /api/users/:id`    | ✅    | ✅          | ❌            | ❌            | ✅ own only    | ❌               | ❌ 403    |
| `POST /api/users`       | ✅    | ✅          | ✅            | ✅            | ✅             | ✅               | ✅ public |
| `PUT /api/users/:id`    | ✅    | ❌          | ✅            | ❌            | ❌             | ✅ own only      | ❌ 403    |
| `DELETE /api/users/:id` | ✅    | ❌          | ❌            | ✅            | ❌             | ❌               | ❌ 403    |
| `GET /api/users/search` | ✅    | ✅          | ❌            | ❌            | ❌             | ❌               | ❌ 403    |

---

## Error Codes

| HTTP Status | Meaning                                      |
| ----------- | -------------------------------------------- |
| `200`       | Success                                      |
| `201`       | Resource created                             |
| `400`       | Bad request (validation error)               |
| `401`       | Unauthorized (missing/invalid/expired token) |
| `403`       | Forbidden (insufficient permissions)         |
| `404`       | Resource not found                           |
| `409`       | Conflict (duplicate username/email)          |
| `500`       | Internal server error                        |

---

## Testing

Run the test suite:

```bash
# Unit tests only (no DB required)
npx jest --config jest.unit.config.js tests/unit/routes/userCrudRbac.test.js --verbose

# All unit tests
npm run test:unit
```

### Test Coverage

The test suite covers **36 test cases** across these categories:

| Category                       | Tests | Description                                                     |
| ------------------------------ | ----- | --------------------------------------------------------------- |
| **Authentication**             | 6     | 401 for missing/invalid tokens on all protected endpoints       |
| **User WITH permissions**      | 14    | Full CRUD with `user:*` permissions, including error cases      |
| **Admin role bypass**          | 3     | Admin can access all endpoints without specific permissions     |
| **User WITHOUT permissions**   | 5     | 403 for users missing `user:*` permissions                      |
| **Ownership-based access**     | 4     | `profile:read/update` grants own-resource access, blocks others |
| **Public endpoint**            | 1     | POST /api/users works without authentication                    |
| **Response envelope contract** | 3     | Validates response structure and field presence                 |
