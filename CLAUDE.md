# CLAUDE.md — Backend Coding Conventions

This file documents conventions for AI assistants (Claude, Copilot, etc.) working on this codebase.

---

## Stack

- Node.js + Express
- Sequelize ORM (MySQL)
- JWT authentication
- Pundit-style policy authorization

---

## Key Conventions

### Routes (`routes/`)

- One router file per resource.
- Middleware order: `authenticate → authorize → (ransackMiddleware) → asyncHandler(controller.action)`.
- Never place business logic or DB calls directly in route files.
- Auth endpoints belong exclusively in `authRoutes.js` (`/api/auth`). Do not duplicate them in resource routes.

### Controllers (`controllers/`)

- Thin. Delegate all DB work and business logic to the matching service.
- Wrap every export in a try/catch that calls `errorResponse(res, err)`.
- Use `asyncHandler` in routes (not raw `async` route callbacks) to propagate errors.
- Per-record policy checks happen here, after loading the record.

### Services (`services/`)

- All Sequelize queries live here.
- Throw typed `AppError` subclasses (`BadRequestError`, `ForbiddenError`, `NotFoundError`, etc.) — never raw `Error`.

### Policies (`policies/`)

- Extend `ApplicationPolicy`.
- Override `index / show / create / update / destroy / scope()`.
- Register in `policies/index.js` `POLICY_MAP`.
- `isAdmin()` — superadmin or `*:*` permission, bypasses everything.
- `scope()` returns a Sequelize `where` clause for list filtering.

### Serializers (`serializers/`)

- One file per resource.
- Whitelist only the fields the API should expose.
- Always call `serialize(record)` or `serializeMany(records)` before passing data to a response helper.

### Response Helpers (`utils/helpers.js`)

- `successResponse(res, data, message, statusCode)` — standard success.
- `errorResponse(res, err)` — pass the caught `Error` object directly.
- `paginatedResponse(res, data, message, { total, page, perPage, pages })` — paginated lists.
- `asyncHandler(fn)` — wraps controller actions in routes.

### Permissions

- Format: `resource:action` (e.g., `user:read`, `user:update`).
- Pass a single string or array to `authorize(...)` middleware.
- `superadmin` role or `*:*` permission bypasses all checks.

---

## Do NOT

- Add business logic or DB calls to route files.
- Duplicate endpoints across multiple routers (e.g., `/users/login` vs `/auth/login`).
- Return raw Sequelize model instances in responses — always serialize first.
- Add new imports to a route/controller for a single inline handler — extract to service/controller instead.
- Leave deprecated routes in place; remove them along with any imports they exclusively use.
