# Backend Conventions & Patterns

## Stack

- **Runtime:** Node.js + Express
- **ORM:** Sequelize
- **Auth:** JWT (`authenticate` middleware)
- **Authorization:** Permission codes + Pundit-style policies

---

## Project Structure

```
controllers/   – Thin controllers; delegate all business logic to services
services/      – Business logic, DB queries
models/        – Sequelize model definitions
routes/        – Express routers (one file per resource)
middleware/    – auth, authorize, upload, ransack, validation
policies/      – Pundit-style per-resource authorization classes
serializers/   – Shape API response objects (one file per resource)
validators/    – Express-validator chains for request bodies
utils/         – Shared helpers (asyncHandler, response helpers)
```

---

## Route Pattern

```js
router.get(
  "/",
  authenticate,
  authorize("resource:read"),
  ransackMiddleware, // optional – adds req.ransack
  asyncHandler(controller.action),
);
```

- Always apply `authenticate` before `authorize`.
- Use `authorizeOwnership(paramKey, bypassPermissions[])` for self/owner access.
- Wrap every controller action in `asyncHandler` – never add raw try/catch in routes.

---

## Controller Pattern

```js
exports.actionName = async (req, res) => {
  try {
    // 1. Load record from service
    // 2. Policy check (if per-record)
    // 3. Call service
    // 4. Serialize + respond
    return successResponse(res, serialize(result), "Message");
  } catch (err) {
    return errorResponse(res, err);
  }
};
```

- Controllers are **thin** – no raw SQL or Sequelize queries.
- Policy checks happen inside the controller, not the route.

---

## Response Helpers (`utils/helpers.js`)

| Helper                                                                   | Use                                                                 |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------- |
| `successResponse(res, data, message, statusCode)`                        | Standard 200/201 response                                           |
| `errorResponse(res, err)`                                                | Pass the caught `Error`; reads `err.statusCode` + `err.message`     |
| `paginatedResponse(res, data, message, { total, page, perPage, pages })` | Paginated list response                                             |
| `asyncHandler(fn)`                                                       | Wraps async controller so errors propagate to Express error handler |

---

## Policy Pattern (Pundit-style)

Every resource has a policy class in `policies/` that extends `ApplicationPolicy`.

```js
// policies/thingPolicy.js
class ThingPolicy extends ApplicationPolicy {
  index() {
    return this.hasPermission("thing:read");
  }
  show() {
    return this.isAdmin() || this._isSelf();
  }
  create() {
    return this.hasPermission("thing:create");
  }
  update() {
    return this.isAdmin() || this._isSelf();
  }
  destroy() {
    return this.isAdmin();
  }
  scope() {
    return this.isAdmin() ? {} : { company_id: this.user.company_id };
  }
}
```

**Usage in controllers:**

```js
const { policy, policyScope } = require("../policies");

// Per-record check
if (!policy("thing", req.user, record).show()) throw new ForbiddenError("...");

// Scope a list query
const scope = policyScope("thing", req.user); // returns Sequelize `where` clause
```

Register new policies in `policies/index.js` `POLICY_MAP`.

---

## Serializer Pattern

One file per resource in `serializers/`. Always serialize before responding.

```js
// serializers/thingSerializer.js
function serialize(record) {
  const plain = record.toJSON ? record.toJSON() : record;
  return { id: plain.id /* only whitelisted fields */ };
}
function serializeMany(records) {
  return records.map(serialize);
}
module.exports = { serialize, serializeMany };
```

---

## Permission Codes Convention

Format: `resource:action`

Examples: `user:read`, `user:create`, `user:update`, `user:delete`, `profile:read`, `profile:update`

`superadmin` role and the `*:*` permission bypass all checks.

---

## Error Classes (`services/errors/AppError.js`)

Throw typed errors from services/controllers; `errorResponse` reads `.statusCode` automatically.

| Class               | HTTP |
| ------------------- | ---- |
| `BadRequestError`   | 400  |
| `UnauthorizedError` | 401  |
| `ForbiddenError`    | 403  |
| `NotFoundError`     | 404  |

---

## Deprecation / Route Cleanup Rules

- Do **not** duplicate routes across routers (e.g., `/users/login` and `/auth/login`).
- Canonical auth endpoints live in `authRoutes.js` under `/api/auth`.
- When removing a deprecated route, also remove any imports used exclusively by it.
