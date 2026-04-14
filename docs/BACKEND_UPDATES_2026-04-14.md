# Backend Update Report (2026-04-14)

Status: Active  
Owner: Backend Team  
Primary scope: RBAC rollout, canonical auth, operator ownership migration, and test safety hardening

## 1. Release objective

This release moved backend authorization from mostly open routes to permission-enforced routes and aligned ownership from legacy `rt_user_id` toward unified `user_id` for operator-managed resources.

Main intent for this phase:

- prioritize operator and association account flows
- stabilize route authorization contracts
- reduce auth/ownership ambiguity in controllers
- protect developer database from destructive test setup

## 2. Explicit constraints and non-goals (confirmed)

The following are intentional in this phase and not regressions:

- Tourist registration still writes to `tourist_users` only.
- Association users cannot self-register through public auth endpoints.
- Association accounts are still provisioned through controlled admin workflows (for example seed/bootstrap flows).

## 3. Architecture-level changes

### 3.1 RBAC data model introduced

Added schema and data bootstrap for role-permission authorization:

- Migrations:
  - `migrations/20260413090000-create-roles-table.js`
  - `migrations/20260413090100-create-permissions-table.js`
  - `migrations/20260413090200-create-roles-permissions-table.js`
  - `migrations/20260413090300-add-role-id-to-user-tables.js`
- Seeders:
  - `seeders/20260413091000-seed-rbac-roles.js`
  - `seeders/20260413091100-seed-rbac-permissions.js`
  - `seeders/20260413091200-seed-rbac-role-permissions.js`

Added models and services for RBAC domain:

- Models: `models/roleModel.js`, `models/permissionModel.js`, `models/rolePermissionModel.js`
- Services: `services/roleService.js`, `services/permissionService.js`
- Controllers/routes:
  - `controllers/roleController.js`, `routes/roleRoutes.js`
  - `controllers/permissionController.js`, `routes/permissionRoutes.js`

### 3.2 Canonical auth layer introduced

Added canonical auth route group:

- `POST /api/auth/login`
- `POST /api/auth/register`
- `GET /api/auth/me`

Implementation files:

- `controllers/authController.js`
- `services/authService.js`
- `routes/authRoutes.js`

Server registration updated in `server.js`.

## 4. Authentication and token contract updates

### 4.1 JWT normalization

`middleware/auth.js` now normalizes decoded payload into a consistent request user shape:

- `role`
- `permissions[]`
- `user_type`
- operator identity via `id`/`unified_user_id`
- non-operator compatibility via `legacy_user_id`
- fallback handling for missing `id` within the applicable identity model

Behavioral change:

- invalid token now returns HTTP 401 instead of 403

### 4.2 Legacy login compatibility bridge

Legacy login endpoints (`/users/login`, `/tourists/login`, `/association-users/login`) now delegate to shared auth service and return deprecation metadata.

Deprecation response hints include:

- `Deprecation: true`
- `Sunset: Thu, 31 Dec 2026 23:59:59 GMT`
- `Link: </api/auth/login>; rel="successor-version"`
- response payload fields `deprecated` and `migrate_to`

Related doc: `docs/RBAC_LEGACY_LOGIN_DEPRECATION.md`

## 5. Authorization rollout across route groups

### 5.1 Middleware added

- `middleware/authorize.js`
  - `authorize(permission | permission[])`
  - `authorizeOwnership(paramKey, bypassPermissions?)`

### 5.2 Protected route coverage expanded

Authorization was applied across route modules including:

- `routes/accomRoutes.js`
- `routes/activityRoutes.js`
- `routes/activityMasterDataRoutes.js`
- `routes/operatorActivitiesRoutes.js`
- `routes/bookingActivityRoutes.js`
- `routes/bookingAccommodationRoutes.js`
- `routes/operatorBookingsRoute.js`
- `routes/touristBookingsRoute.js`
- `routes/formRoutes.js`
- `routes/receiptRoutes.js`
- `routes/notificationRoutes.js`
- `routes/userRoutes.js`
- `routes/associationUserRoutes.js`
- `routes/touristUserRoutes.js`
- `routes/associationRoutes.js`

Behavior impact:

- missing token: 401
- insufficient permission: 403
- owner-only endpoints now enforce identity checks for non-admin accounts

Frozen contract reference: `docs/RBAC_ROUTE_PERMISSION_MATRIX.md`

## 6. Ownership migration: `rt_user_id` to `user_id`

### 6.1 Data migration and foreign key updates

Primary migration:

- `migrations/20260414120000-migrate-operator-ownership-to-unified-users.js`

Supporting FK correction migration:

- `migrations/20260413173000-fix-booking-foreign-keys.js`

### 6.2 Model-level alias strategy

Operator-owned domain models now use physical `user_id` while preserving `rt_user_id` compatibility through virtual aliases where needed.

Examples:

- `models/accomModel.js`
- `models/operatorActivitiesModel.js`

### 6.3 Controller enforcement

Controllers now derive requester context and enforce ownership on mutate paths.

Examples:

- `controllers/accomController.js`
- `controllers/activityController.js`

Common pattern introduced:

- resolve requester id from normalized token (`unified_user_id` for operator, `legacy_user_id` compatibility for tourist/association)
- allow admin bypass
- reject cross-owner create/update/delete with 403

## 7. Unified user and company integration

### 7.1 New unified structures

Added unified user/company schema and seed migration:

- `migrations/20260413093000-create-unified-users-table.js`
- `migrations/20260413094000-create-company-table.js`
- `migrations/20260413131500-seed-users-and-company-from-rt-users.js`

New models:

- `models/unifiedUserModel.js`
- `models/companyModel.js`

### 7.2 Association map refactor

`models/associations.js` was expanded to wire:

- role-permission links
- role-user links across user domains
- unified user to association/company
- operator activity links to unified operator user

### 7.3 API response normalization

Several controllers now serialize operator profile data from unified user + company relation (for example `business_name`, `company_logo` sources), replacing direct legacy table assumptions.

## 8. Registration and account behavior matrix

| User type   | Registration path                           | Persistence target  | Current status         |
| ----------- | ------------------------------------------- | ------------------- | ---------------------- |
| Operator    | `/api/auth/register` (`user_type=operator`) | `users` + `company` | Active                 |
| Tourist     | `/api/auth/register` (`user_type=tourist`)  | `tourist_users`     | Intentionally retained |
| Association | `/api/auth/register`                        | Blocked             | Intentionally blocked  |

Supporting touched files:

- `controllers/userController.js`
- `controllers/touristUserController.js`
- `controllers/associationUserController.js`
- `services/authService.js`

## 9. Runtime hardening and bug/noise reduction

### 9.1 Search middleware safety

`middleware/ransackSearch.js` now defends against non-object or malformed query input and returns clean 400 for invalid search parameter shape.

### 9.2 Activity filter error handling

`controllers/activityController.js` was adjusted so expected invalid date/filter validation errors return 400 without noisy server-error logging.

## 10. Test environment safety and validation

### 10.1 Test DB isolation

To prevent accidental dev DB truncation during tests:

- `config/db.js` now resolves test DB as `DB_TEST_NAME` or `${DB_NAME}_test`
- `config/config.js` test config mirrors the same fallback
- `tests/setup.js` now ensures test database exists before destructive sync

### 10.2 Coverage additions/updates

Added/updated security contract tests:

- `tests/unit/middleware/auth.test.js`
- `tests/unit/middleware/authorize.test.js`
- `tests/unit/routes/rbacRouteContracts.test.js`
- `tests/unit/routes/financialAuthorization.test.js`

Also updated integration tests to include auth headers and unified ownership ids in relevant flows.

## 11. Operational assets added

Deployment and runbook documentation delivered:

- `docs/RBAC_ROLLOUT_RUNBOOK.md`
- `docs/RBAC_ADMIN_BOOTSTRAP.md`
- `docs/RBAC_ROUTE_PERMISSION_MATRIX.md`
- `docs/RBAC_LEGACY_LOGIN_DEPRECATION.md`

Admin bootstrap helper:

- `scripts/bootstrapAdminRole.js`
- npm script in `package.json`: `rbac:bootstrap-admin`

## 12. Known risks and follow-up work

### 12.1 In-progress migration edges

- Frontend still uses selective legacy fallback fields in some places.
- Full tourist migration to unified users remains deferred.
- Some compatibility aliases remain to avoid client breakage during rollout.

### 12.2 Recommended next iteration

- complete frontend field normalization endpoint by endpoint
- define and execute timeline for legacy login endpoint removal
- add release-gate smoke test for permission matrix regressions
- finalize long-term strategy for tourist unification (or formalize permanent split)

## 13. Quick index of key touched backend files

### Auth and RBAC core

- `controllers/authController.js`
- `middleware/auth.js`
- `middleware/authorize.js`
- `services/authService.js`
- `services/roleService.js`
- `services/permissionService.js`
- `routes/authRoutes.js`
- `routes/roleRoutes.js`
- `routes/permissionRoutes.js`

### Domain controllers with ownership and model updates

- `controllers/accomController.js`
- `controllers/activityController.js`
- `controllers/operatorActivitiesController.js`
- `controllers/operatorBookingsController.js`
- `controllers/touristBookingsController.js`
- `controllers/userController.js`

### Models and associations

- `models/accomModel.js`
- `models/operatorActivitiesModel.js`
- `models/associations.js`
- `models/unifiedUserModel.js`
- `models/companyModel.js`
- `models/index.js`

### DB migrations/seeders

- all RBAC migrations/seeders listed above
- ownership/unified migrations listed above

### Test and config hardening

- `config/db.js`
- `config/config.js`
- `tests/setup.js`
- RBAC/unit route tests listed above

## 14. Session delta (frontend integration sync)

This section records the latest sync point after frontend shared-navigation stabilization work.

### 14.1 Backend contract status in this session

- no new backend source-code changes were required in this latest sync round
- canonical contracts remain the same as documented above:
  - `POST /api/auth/login`
  - `GET /api/auth/me`
  - `GET /api/associations/public`
- existing RBAC route/permission mapping in `docs/RBAC_ROUTE_PERMISSION_MATRIX.md` remains the active frozen reference

### 14.2 Frontend dependency note

Frontend now merges profile payloads from `/api/users/:id` into existing auth state while preserving JWT-derived role/permission claims.

Implication:

- `/api/users/:id` may continue serving profile-centric fields without being the authority for RBAC claims
- JWT/canonical auth payload (`/api/auth/login`, `/api/auth/me`) remains the authority for role + permissions used by guards

### 14.3 Operational follow-up

- keep deprecation headers on legacy login routes until sunset milestone
- keep `/api/auth/me` response shape stable during frontend hardening phase
- continue using RBAC contract tests as release gate for protected route regressions
