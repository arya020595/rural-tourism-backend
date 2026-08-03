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

### Migrations (`migrations/`)

- This project targets **MySQL only**. Sequelize does not always error when a migration option isn't supported by the current dialect — some are silently dropped instead. Notably, `addIndex(..., { where })` (partial/filtered index) is a Postgres/SQLite/MSSQL feature; MySQL has no partial index support, and Sequelize's MySQL dialect just drops the `where` clause and creates a full-table index instead. If you're porting a pattern from Postgres docs/examples, verify it against MySQL semantics first.
  - To emulate a partial unique index on MySQL, add a generated (`STORED`) column that evaluates to `NULL` for rows outside the target condition — NULLs never collide in a MySQL/InnoDB unique index — and put the unique index on that column instead of using `where`. See `migrations/20260518000001-add-unique-index-to-notifications.js`.
- Test new migrations locally against a real MySQL instance before merging (`docker run -e MYSQL_ROOT_PASSWORD=root -e MYSQL_DATABASE=<db> -p 3307:3306 mysql:8.0`), seeded with realistic/dirty data, not just an empty schema. `tests/setup.js` builds the test DB via `sequelize.sync()` and never executes `migrations/**`, and CI's `migration-check` job (below) only proves a migration runs against a *clean* database — neither will catch a migration that fails because of data already sitting in production (e.g. a new unique constraint colliding with existing duplicate rows).
- A few existing migrations assume specific seeders already ran against the database at that point (RBAC roles, the `bi_dashboard` permission) rather than seeding what they need themselves — a side effect of production being deployed incrementally over months rather than replayed from scratch. `.github/workflows/ci.yml`'s `migration-check` job hardcodes the checkpoints needed to replay the full history in CI. **New migrations should seed/upsert any data they depend on themselves** rather than assuming a seeder ran first — it keeps the migration self-contained and avoids adding another checkpoint to that CI job.

---

## Do NOT

- Add business logic or DB calls to route files.
- Duplicate endpoints across multiple routers (e.g., `/users/login` vs `/auth/login`).
- Return raw Sequelize model instances in responses — always serialize first.
- Add new imports to a route/controller for a single inline handler — extract to service/controller instead.
- Leave deprecated routes in place; remove them along with any imports they exclusively use.
