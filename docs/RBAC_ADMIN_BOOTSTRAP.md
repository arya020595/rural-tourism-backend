# RBAC Admin Bootstrap Procedure

Status: Active
Last updated: 2026-04-13
Owner: Backend Team

## Purpose

Bootstrap at least one admin account after RBAC migrations/seeders are applied.

This project uses a compatibility-first RBAC overlay with role assignment in legacy user tables:

- `rt_users.role_id`
- `tourist_users.role_id`
- `association_users.role_id`

## Preconditions

1. RBAC migrations are up:
   - `20260413090000-create-roles-table.js`
   - `20260413090100-create-permissions-table.js`
   - `20260413090200-create-roles-permissions-table.js`
   - `20260413090300-add-role-id-to-user-tables.js`
2. RBAC seeders are applied:
   - `20260413091000-seed-rbac-roles.js`
   - `20260413091100-seed-rbac-permissions.js`
   - `20260413091200-seed-rbac-role-permissions.js`
3. A target user account already exists in one legacy user table.

## Preferred Method (Scripted)

Use the helper script to assign the `admin` role to one account.

Preview only:

```bash
npm run rbac:bootstrap-admin -- --user-type operator --user-id 1 --dry-run
```

Apply update:

```bash
npm run rbac:bootstrap-admin -- --user-type operator --user-id 1
```

Lookup by username:

```bash
npm run rbac:bootstrap-admin -- --user-type association --username association_admin
```

Lookup by email:

```bash
npm run rbac:bootstrap-admin -- --user-type tourist --email admin@example.com
```

Allowed values for `--user-type`:

- `operator`
- `tourist`
- `association`

## Manual SQL Fallback

If script execution is unavailable, assign admin role directly with SQL.

1. Get admin role id:

```sql
SELECT id, name FROM roles WHERE name = 'admin';
```

2. Update the selected account (example for operator id=1):

```sql
UPDATE rt_users
SET role_id = <admin_role_id>
WHERE user_id = 1;
```

Equivalent updates for other user tables:

- `tourist_users` uses primary key `tourist_user_id`
- `association_users` uses primary key `id`

## Validation

1. Verify persisted role assignment in database:

```sql
SELECT user_id, username, role_id FROM rt_users WHERE user_id = 1;
```

2. Login through canonical endpoint and confirm role/permissions in response:

`POST /api/auth/login`

Expected user payload:

- `role.name = "admin"`
- `permissions` contains `*:*` (or effective full access)

3. Verify admin bypass on a protected endpoint that requires elevated permission.

## Operational Guardrails

- Bootstrap only the minimum number of admin users required.
- Use a ticketed change request for each admin promotion.
- Never accept role assignment from public registration payloads.
- Prefer script + audit log capture over ad-hoc SQL.