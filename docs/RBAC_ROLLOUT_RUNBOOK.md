# RBAC Rollout Runbook

Status: Active
Last updated: 2026-04-13
Owner: Backend Team

## Scope

Operational runbook for rolling out backend RBAC overlay safely in development, staging, and production.

This runbook covers:

- migration sequence
- RBAC seeding sequence
- post-deploy verification
- rollback sequence
- compatibility checks during legacy login transition

Related contracts:

- `docs/RBAC_ROUTE_PERMISSION_MATRIX.md`
- `docs/RBAC_LEGACY_LOGIN_DEPRECATION.md`
- `docs/RBAC_ADMIN_BOOTSTRAP.md`

## 1) Pre-Deployment Checklist

1. Confirm current deploy revision and environment (`dev` / `staging` / `prod`).
2. Ensure a fresh database backup exists.
3. Confirm `JWT_SECRET` and DB credentials are set for target environment.
4. Confirm app image/build includes RBAC files:
   - `middleware/authorize.js`
   - `routes/authRoutes.js`
   - `routes/roleRoutes.js`
   - `routes/permissionRoutes.js`
5. Confirm rollback operator has CLI access.

## 2) Migration Sequence

Local/staging:

```bash
npm run db:migrate
npm run db:migrate:status
```

Docker production:

```bash
docker compose run --rm backend npm run db:migrate
docker compose exec -T backend npm run db:migrate:status
```

Expected RBAC migrations as `up`:

- `20260413090000-create-roles-table.js`
- `20260413090100-create-permissions-table.js`
- `20260413090200-create-roles-permissions-table.js`
- `20260413090300-add-role-id-to-user-tables.js`

Optional compatibility migrations (if part of release scope):

- `20260413093000-create-unified-users-table.js`
- `20260413094000-create-company-table.js`

## 3) RBAC Seeding Sequence

Apply RBAC seeders explicitly to avoid accidental sample-data seeding in production:

```bash
npx sequelize-cli db:seed --seed 20260413091000-seed-rbac-roles.js
npx sequelize-cli db:seed --seed 20260413091100-seed-rbac-permissions.js
npx sequelize-cli db:seed --seed 20260413091200-seed-rbac-role-permissions.js
```

Cardinality checks:

```sql
SELECT COUNT(*) AS roles_count FROM roles;
SELECT COUNT(*) AS permissions_count FROM permissions;
SELECT COUNT(*) AS role_permission_count FROM roles_permissions;
```

Expected baseline counts for default seed set:

- roles: `4`
- permissions: `27`
- role-permission mappings: `31`

## 4) Admin Bootstrap

Bootstrap admin role assignment before enabling restricted admin workflows.

Use script:

```bash
npm run rbac:bootstrap-admin -- --user-type operator --user-id 1 --dry-run
npm run rbac:bootstrap-admin -- --user-type operator --user-id 1
```

Procedure details are in `docs/RBAC_ADMIN_BOOTSTRAP.md`.

## 5) Contract Smoke Tests

1. Canonical auth login:

- `POST /api/auth/login`
- Verify response envelope contains:
  - `success`
  - `message`
  - `data.token`
  - `data.user.role`
  - `data.user.permissions`

2. Protected route without token returns `401`.

3. Protected route with insufficient permission returns `403` and includes required permission context.

4. Protected route with sufficient permission returns `2xx`.

5. Legacy login compatibility:

- `POST /api/users/login`
- `POST /api/tourists/login`
- `POST /api/association-users/login`

Verify each includes deprecation metadata:

- `Deprecation: true`
- `Sunset: Thu, 31 Dec 2026 23:59:59 GMT`
- `Link: </api/auth/login>; rel="successor-version"`
- response JSON includes `deprecated` and `migrate_to`

## 6) Automated Verification

Run targeted RBAC tests:

```bash
npx jest tests/unit/middleware/auth.test.js tests/unit/middleware/authorize.test.js tests/unit/routes/rbacRouteContracts.test.js tests/unit/routes/financialAuthorization.test.js
```

Recommended full checks:

```bash
npm run test:unit
npm run test:integration
```

## 7) Rollback Sequence

Use rollback only for release-blocking incidents.

### 7.1 Seed Rollback (RBAC seeders only)

```bash
npx sequelize-cli db:seed:undo --seed 20260413091200-seed-rbac-role-permissions.js
npx sequelize-cli db:seed:undo --seed 20260413091100-seed-rbac-permissions.js
npx sequelize-cli db:seed:undo --seed 20260413091000-seed-rbac-roles.js
```

### 7.2 Migration Rollback (reverse order)

If optional unified/company migrations were deployed, undo first:

```bash
npx sequelize-cli db:migrate:undo --name 20260413094000-create-company-table.js
npx sequelize-cli db:migrate:undo --name 20260413093000-create-unified-users-table.js
```

Then rollback RBAC overlay migrations:

```bash
npx sequelize-cli db:migrate:undo --name 20260413090300-add-role-id-to-user-tables.js
npx sequelize-cli db:migrate:undo --name 20260413090200-create-roles-permissions-table.js
npx sequelize-cli db:migrate:undo --name 20260413090100-create-permissions-table.js
npx sequelize-cli db:migrate:undo --name 20260413090000-create-roles-table.js
```

Re-check status:

```bash
npm run db:migrate:status
```

## 8) Incident Notes Template

Capture the following for every rollout:

1. environment + release id
2. migration and seeder command outputs
3. smoke-test outcomes (`401` / `403` / `2xx`)
4. legacy-login compatibility result
5. rollback actions (if any)
6. follow-up action items and owner