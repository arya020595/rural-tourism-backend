# Technical Analysis: Role-Based Access Control (RBAC)

## Implementation Status (2026-04-13)

Status: Implemented (compatibility-first rollout complete).

- Backend RBAC overlay is active across protected routes with role/permission and ownership enforcement.
- Frontend RBAC integration is active with role/permission guards, permission directive, unauthorized page, and permission-aware menus.
- Canonical auth endpoint is active at `POST /api/auth/login`; legacy login endpoints remain available during deprecation window.
- Auth resolution is intentionally compatibility-first via existing user tables (`rt_users`, `tourist_users`, `association_users`).
- Unified `users` table migrations exist, but full legacy-to-unified data cutover remains out of scope for this rollout.

### 2026-04-14 Delta (Operator Ownership Contract)

- Active backend runtime no longer accepts or emits `rt_user_id` on operator ownership APIs.
- Operator ownership now uses `user_id` end-to-end in active controllers/models/routes.
- Frontend booking/operator pages were aligned to `user_id` and no longer rely on `rt_user_id` fallback.
- Operator auth token/session payloads now use unified identity (`id`/`unified_user_id`) and do not emit `legacy_user_id`.
- Auth middleware no longer derives operator identity from `legacy_user_id`; operator tokens must carry `id` or `unified_user_id`.
- Tourist and association auth payloads retain legacy identity compatibility during transition.
- Runtime scripts now target unified users (`users`) instead of the legacy operator model.
- Legacy table/model references remain only for migration and rollback history, not active request handling.

## 1. Overview

### 1.1 Feature Summary

Implement a full Role-Based Access Control (RBAC) system spanning backend and frontend. The new ERD consolidates all user types into a single `users` table linked to `roles`, `permissions`, and `roles_permissions` tables. The backend will enforce authorization on every protected endpoint, and the frontend will adapt the UI based on the user's role and permissions received from the login response.

### 1.2 Current State

| Area            | Current                                                              | Problem                                                   |
| --------------- | -------------------------------------------------------------------- | --------------------------------------------------------- |
| User tables     | 3 separate tables (`rt_users`, `tourist_users`, `association_users`) | No unified identity; role is hardcoded on the client side |
| Auth middleware | `authenticate` exists but is **never applied** to any route          | All endpoints are publicly accessible                     |
| Authorization   | Zero permission checks across entire codebase                        | Anyone can call any endpoint, access any user's data      |
| JWT payload     | `{ id, username }` — no role/permissions                             | Frontend guesses role from login endpoint used            |
| Frontend guard  | `authGuard` checks `localStorage.getItem('uid')` only                | No role-based route protection                            |
| Frontend role   | Hardcoded as `'operator'` or `'tourist'` at login time               | Not server-driven; easily spoofable                       |

### 1.3 New ERD — Unified Users Table

```
┌──────────────┐     ┌──────────┐     ┌───────────────────┐     ┌──────────────┐
│    users      │────►│  roles    │────►│ roles_permissions  │◄────│ permissions  │
├──────────────┤     ├──────────┤     ├───────────────────┤     ├──────────────┤
│ UniqueID (PK)│     │ UniqueID │     │ UniqueID          │     │ UniqueID     │
│ name         │     │ name     │     │ role_id (FK)      │     │ name         │
│ username     │     │ created_at│    │ permission_id (FK)│     │ code         │
│ email        │     │ updated_at│    │ created_at        │     │ resource     │
│ password     │     └──────────┘     │ updated_at        │     │ section      │
│ confirm_pass │                      └───────────────────┘     │ created_at   │
│ association_id│                                                │ updated_at   │
│ role_id (FK) │                                                └──────────────┘
│ company_id   │
│ created_at   │
│ updated_at   │
└──────────────┘
```

### 1.4 Scope

| In Scope                                                           | Out of Scope                                          |
| ------------------------------------------------------------------ | ----------------------------------------------------- |
| Backend: roles, permissions, roles_permissions models + migrations | Data migration from 3 old tables into unified `users` |
| Backend: authorize middleware (role + permission checks)           | Rate limiting, IP whitelisting                        |
| Backend: JWT payload with role + permissions                       | OAuth / social login                                  |
| Backend: seed data for default roles and permissions               | Audit logging (can be added later)                    |
| Frontend: permission-based route guards                            | Frontend UI redesign                                  |
| Frontend: permission directive for template elements               | Mobile push notification permissions                  |
| Frontend: updated auth service with role/permissions state         |                                                       |

---

## 2. Architecture

### 2.1 RBAC Model

```
User ──(N:1)──► Role ──(N:M)──► Permission

Examples:
  User "Ahmad" ──► Role "operator" ──► Permissions: [
    "accommodation:create", "accommodation:read", "accommodation:update", "accommodation:delete",
    "activity:create", "activity:read", "activity:update", "activity:delete",
    "booking:read", "booking:update",
    "receipt:create", "receipt:read"
  ]

  User "Sarah" ──► Role "tourist" ──► Permissions: [
    "accommodation:read",
    "activity:read",
    "booking:create", "booking:read",
    "profile:read", "profile:update"
  ]

  User "Admin" ──► Role "admin" ──► Permissions: [
    "*:*"  (all resources, all actions)
  ]
```

### 2.2 Permission Naming Convention

```
{resource}:{action}

resource = accommodation | activity | booking | receipt | user | profile | association | role | permission
action   = create | read | update | delete | manage

Special: "*:*" = superadmin (all permissions)
```

The `code` field in the `permissions` table stores this string (e.g., `"accommodation:create"`).
The `resource` field stores the resource name (e.g., `"accommodation"`).
The `section` field groups permissions for UI display (e.g., `"Accommodation Management"`).

### 2.3 Full-Stack Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              BACKEND                                     │
│                                                                          │
│  Login Endpoint                                                          │
│  POST /api/auth/login                                                    │
│       │                                                                  │
│       ▼                                                                  │
│  AuthService.login(email, password)                                      │
│       │                                                                  │
│       ├── Validate credentials (bcrypt.compare)                          │
│       ├── Fetch user with role + permissions (eager load)                │
│       ├── Build JWT payload: { id, username, role, permissions[] }       │
│       └── Return: { token, user: { id, name, role, permissions[] } }    │
│                                                                          │
│  Protected Endpoints                                                     │
│  GET /api/accommodations                                                 │
│       │                                                                  │
│       ├── authenticate middleware  → verify JWT, attach req.user         │
│       ├── authorize('accommodation:read') → check permission in req.user│
│       └── controller → service → model → response                       │
│                                                                          │
├──────────────────────────────────────────────────────────────────────────┤
│                              FRONTEND                                    │
│                                                                          │
│  Login Flow                                                              │
│       │                                                                  │
│       ├── POST /api/auth/login → receive { token, user }                │
│       ├── Store token + user (with role + permissions[]) in storage      │
│       ├── AuthService.currentUser$ emits with role + permissions         │
│       └── Router navigates to role-appropriate dashboard                 │
│                                                                          │
│  Route Guards                                                            │
│       │                                                                  │
│       ├── authGuard → is user authenticated? (token exists + not expired)│
│       ├── roleGuard('operator') → does user have this role?              │
│       └── permissionGuard('accommodation:create') → has permission?      │
│                                                                          │
│  Template Rendering                                                      │
│       │                                                                  │
│       └── *hasPermission="'accommodation:delete'" directive              │
│           → show/hide buttons, menu items, sections                      │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### 2.4 SOLID Principles

| Principle                     | Backend Application                                                                                                       | Frontend Application                                                                                  |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| **S** — Single Responsibility | `RoleService` manages roles only. `PermissionService` manages permissions only. `AuthorizeMiddleware` only checks access. | `AuthService` manages auth state. `PermissionService` checks permissions. Guards only protect routes. |
| **O** — Open/Closed           | New permissions added via DB seed — no code changes. New roles added without modifying middleware.                        | New permission checks added via directive/guard config — no service changes needed.                   |
| **L** — Liskov Substitution   | All error subclasses (`ForbiddenError`, `UnauthorizedError`) substitutable for `AppError`.                                | All guards implement `CanActivateFn` interface uniformly.                                             |
| **I** — Interface Segregation | Controller uses only `authorize(permission)`, not the full role/permission service surface.                               | Components use only `hasPermission(code)`, not the full permission resolution logic.                  |
| **D** — Dependency Inversion  | Middleware depends on `req.user.permissions[]` abstraction, not on specific DB queries.                                   | Guards depend on `PermissionService.hasPermission()` abstraction, not on storage details.             |

---

## 3. Backend Design

### 3.1 Database Schema

#### 3.1.1 `roles` Table

| Column     | Type       | Constraints        | Description                                                             |
| ---------- | ---------- | ------------------ | ----------------------------------------------------------------------- |
| id         | INTEGER    | PK, auto-increment | Unique identifier                                                       |
| name       | STRING(50) | NOT NULL, UNIQUE   | Role name (e.g., `"admin"`, `"operator"`, `"tourist"`, `"association"`) |
| created_at | DATE       | NOT NULL           |                                                                         |
| updated_at | DATE       | NOT NULL           |                                                                         |

#### 3.1.2 `permissions` Table

| Column     | Type        | Constraints        | Description                                           |
| ---------- | ----------- | ------------------ | ----------------------------------------------------- |
| id         | INTEGER     | PK, auto-increment | Unique identifier                                     |
| name       | STRING(100) | NOT NULL           | Human-readable name (e.g., `"Create Accommodation"`)  |
| code       | STRING(100) | NOT NULL, UNIQUE   | Machine code (e.g., `"accommodation:create"`)         |
| resource   | STRING(50)  | NOT NULL           | Resource group (e.g., `"accommodation"`)              |
| section    | STRING(100) | NOT NULL           | UI section group (e.g., `"Accommodation Management"`) |
| created_at | DATE        | NOT NULL           |                                                       |
| updated_at | DATE        | NOT NULL           |                                                       |

#### 3.1.3 `roles_permissions` Table (Join)

| Column        | Type    | Constraints                   | Description       |
| ------------- | ------- | ----------------------------- | ----------------- |
| id            | INTEGER | PK, auto-increment            | Unique identifier |
| role_id       | INTEGER | FK → roles.id, NOT NULL       |                   |
| permission_id | INTEGER | FK → permissions.id, NOT NULL |                   |
| created_at    | DATE    | NOT NULL                      |                   |
| updated_at    | DATE    | NOT NULL                      |                   |

**Unique constraint**: `(role_id, permission_id)` — prevents duplicate assignments.

#### 3.1.4 `users` Table Update

Add `role_id` column:

| Column  | Type    | Constraints             | Description          |
| ------- | ------- | ----------------------- | -------------------- |
| role_id | INTEGER | FK → roles.id, NOT NULL | User's assigned role |

### 3.2 Seed Data

#### Default Roles

| ID  | Name        |
| --- | ----------- |
| 1   | admin       |
| 2   | operator    |
| 3   | tourist     |
| 4   | association |

#### Default Permissions

| Code                       | Name                     | Resource      | Section                      |
| -------------------------- | ------------------------ | ------------- | ---------------------------- |
| `user:create`              | Create User              | user          | User Management              |
| `user:read`                | View Users               | user          | User Management              |
| `user:update`              | Update User              | user          | User Management              |
| `user:delete`              | Delete User              | user          | User Management              |
| `profile:read`             | View Own Profile         | profile       | Profile                      |
| `profile:update`           | Update Own Profile       | profile       | Profile                      |
| `accommodation:create`     | Create Accommodation     | accommodation | Accommodation Management     |
| `accommodation:read`       | View Accommodations      | accommodation | Accommodation Management     |
| `accommodation:update`     | Update Accommodation     | accommodation | Accommodation Management     |
| `accommodation:delete`     | Delete Accommodation     | accommodation | Accommodation Management     |
| `activity:create`          | Create Activity          | activity      | Activity Management          |
| `activity:read`            | View Activities          | activity      | Activity Management          |
| `activity:update`          | Update Activity          | activity      | Activity Management          |
| `activity:delete`          | Delete Activity          | activity      | Activity Management          |
| `booking:create`           | Create Booking           | booking       | Booking Management           |
| `booking:read`             | View Bookings            | booking       | Booking Management           |
| `booking:update`           | Update Booking           | booking       | Booking Management           |
| `booking:delete`           | Cancel Booking           | booking       | Booking Management           |
| `receipt:create`           | Create Receipt           | receipt       | Receipt Management           |
| `receipt:read`             | View Receipts            | receipt       | Receipt Management           |
| `association:read`         | View Association         | association   | Association Management       |
| `association:update`       | Update Association       | association   | Association Management       |
| `association:manage_users` | Manage Association Users | association   | Association Management       |
| `role:read`                | View Roles               | role          | Role & Permission Management |
| `role:update`              | Update Roles             | role          | Role & Permission Management |
| `permission:read`          | View Permissions         | permission    | Role & Permission Management |

#### Default Role → Permission Mapping

| Role            | Permissions                                                                                                                                |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **admin**       | All permissions                                                                                                                            |
| **operator**    | `profile:*`, `accommodation:create/read/update/delete`, `activity:create/read/update/delete`, `booking:read/update`, `receipt:create/read` |
| **tourist**     | `profile:*`, `accommodation:read`, `activity:read`, `booking:create/read`, `receipt:read`                                                  |
| **association** | `profile:*`, `association:read/update/manage_users`, `user:read`, `accommodation:read`, `activity:read`, `booking:read`                    |

### 3.3 Models (Sequelize)

#### 3.3.1 Role Model (`models/roleModel.js`)

```javascript
// Fields: id, name
// Associations:
//   Role.belongsToMany(Permission, { through: RolePermission })
//   Role.hasMany(User)
```

#### 3.3.2 Permission Model (`models/permissionModel.js`)

```javascript
// Fields: id, name, code, resource, section
// Associations:
//   Permission.belongsToMany(Role, { through: RolePermission })
```

#### 3.3.3 RolePermission Model (`models/rolePermissionModel.js`)

```javascript
// Fields: id, role_id, permission_id
// Join table — no additional business logic
```

#### 3.3.4 User Model Update (`models/userModel.js`)

```javascript
// Add: role_id (INTEGER, FK → roles.id)
// Association: User.belongsTo(Role)
```

### 3.4 Backend API Response — Login

The login endpoint returns the user's role and permissions. This is the **single source of truth** for the frontend.

#### Request

```
POST /api/auth/login
Content-Type: application/json

{
  "email": "operator@example.com",
  "password": "securePassword123"
}
```

#### Response (`200 OK`)

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": 1,
      "name": "Ahmad bin Ali",
      "username": "ahmad_ali",
      "email": "operator@example.com",
      "role": {
        "id": 2,
        "name": "operator"
      },
      "permissions": [
        "profile:read",
        "profile:update",
        "accommodation:create",
        "accommodation:read",
        "accommodation:update",
        "accommodation:delete",
        "activity:create",
        "activity:read",
        "activity:update",
        "activity:delete",
        "booking:read",
        "booking:update",
        "receipt:create",
        "receipt:read"
      ]
    }
  }
}
```

#### JWT Payload

```json
{
  "id": 1,
  "username": "ahmad_ali",
  "role": "operator",
  "permissions": [
    "profile:read",
    "profile:update",
    "accommodation:create",
    "accommodation:read",
    ...
  ],
  "iat": 1712700000,
  "exp": 1712786400
}
```

> **Why include permissions in JWT?** Avoids a DB query on every request. The middleware reads permissions directly from the decoded token. Trade-off: token is larger (~1KB) but eliminates N+1 auth queries.

### 3.5 Middleware

#### 3.5.1 `authenticate` (Updated)

```
authenticate(req, res, next)
  → Verify JWT
  → Attach to req.user: { id, username, role, permissions[] }
  → next()
```

No changes to the core logic — it already decodes the full payload. The difference is that the JWT now **contains** role and permissions.

#### 3.5.2 `authorize` (New)

```javascript
// Usage in routes:
router.post(
  "/accommodations",
  authenticate,
  authorize("accommodation:create"),
  controller.create,
);
router.get(
  "/accommodations",
  authenticate,
  authorize("accommodation:read"),
  controller.getAll,
);
router.put(
  "/accommodations/:id",
  authenticate,
  authorize("accommodation:update"),
  controller.update,
);
router.delete(
  "/accommodations/:id",
  authenticate,
  authorize("accommodation:delete"),
  controller.delete,
);
```

```
authorize(requiredPermission)
  → return middleware(req, res, next)
    → if req.user.permissions includes requiredPermission → next()
    → if req.user.role === 'admin' → next()  (admin bypass)
    → else → 403 Forbidden
```

#### 3.5.3 `authorizeOwnership` (New)

For endpoints where a user should only access their own resources:

```javascript
// Usage:
router.get(
  "/accommodations/mine",
  authenticate,
  authorizeOwnership("user_id"),
  controller.getByUser,
);
```

```
authorizeOwnership(ownerField)
  → return middleware(req, res, next)
    → if req.user.role === 'admin' → next()  (admin bypass)
    → if req.params[ownerField] === req.user.id → next()
    → else → 403 Forbidden
```

### 3.6 Service Layer

#### 3.6.1 `services/roleService.js`

```
class RoleService {
  async getAllRoles()
  async getRoleById(id)
  async getRoleWithPermissions(id)
  async createRole(data)
  async updateRole(id, data)
  async assignPermissionsToRole(roleId, permissionIds[])
  async removePermissionsFromRole(roleId, permissionIds[])
}
```

**S**: Only manages role CRUD and role-permission assignments.

#### 3.6.2 `services/permissionService.js`

```
class PermissionService {
  async getAllPermissions()
  async getPermissionsByResource(resource)
  async getPermissionsByRole(roleId)
}
```

**S**: Only manages permission queries. Permissions are seeded, not user-created.

#### 3.6.3 `services/authService.js` (New — Unified Login)

```
class AuthService {
  async login(email, password)
    → Find user by email (include Role → Permissions)
    → Validate password (bcrypt.compare)
    → Build permissions array from role.permissions[].code
    → Generate JWT with { id, username, role: role.name, permissions }
    → Return { token, user: { id, name, username, email, role, permissions } }

  async getUserWithPermissions(userId)
    → Eager load user → role → permissions
    → Return structured user object
}
```

**S**: Only handles authentication logic. Does not handle registration, profile updates, etc.

### 3.7 Route Protection Matrix

| Method | Endpoint                  | Auth | Permission             | Ownership      |
| ------ | ------------------------- | ---- | ---------------------- | -------------- |
| POST   | `/api/auth/login`         | —    | —                      | —              |
| POST   | `/api/auth/register`      | —    | —                      | —              |
| GET    | `/api/users`              | ✅   | `user:read`            | —              |
| GET    | `/api/users/:id`          | ✅   | `user:read`            | —              |
| PUT    | `/api/users/:id`          | ✅   | `user:update`          | owner or admin |
| DELETE | `/api/users/:id`          | ✅   | `user:delete`          | admin only     |
| GET    | `/api/accommodations`     | ✅   | `accommodation:read`   | —              |
| POST   | `/api/accommodations`     | ✅   | `accommodation:create` | —              |
| PUT    | `/api/accommodations/:id` | ✅   | `accommodation:update` | owner or admin |
| DELETE | `/api/accommodations/:id` | ✅   | `accommodation:delete` | owner or admin |
| GET    | `/api/activities`         | ✅   | `activity:read`        | —              |
| POST   | `/api/activities`         | ✅   | `activity:create`      | —              |
| PUT    | `/api/activities/:id`     | ✅   | `activity:update`      | owner or admin |
| DELETE | `/api/activities/:id`     | ✅   | `activity:delete`      | owner or admin |
| POST   | `/api/bookings`           | ✅   | `booking:create`       | —              |
| GET    | `/api/bookings`           | ✅   | `booking:read`         | scoped to user |
| PUT    | `/api/bookings/:id`       | ✅   | `booking:update`       | owner or admin |
| GET    | `/api/roles`              | ✅   | `role:read`            | admin only     |
| PUT    | `/api/roles/:id`          | ✅   | `role:update`          | admin only     |
| GET    | `/api/permissions`        | ✅   | `permission:read`      | admin only     |

### 3.8 Error Responses

#### 401 Unauthorized — No Token / Expired Token

```json
{
  "success": false,
  "message": "Access denied. No token provided."
}
```

#### 403 Forbidden — Insufficient Permissions

```json
{
  "success": false,
  "message": "Forbidden. You do not have permission to perform this action.",
  "data": {
    "required": "accommodation:delete",
    "your_role": "tourist"
  }
}
```

---

## 4. Frontend Design

### 4.1 What the Frontend Receives

On login, the backend sends:

```json
{
  "success": true,
  "data": {
    "token": "eyJ...",
    "user": {
      "id": 1,
      "name": "Ahmad",
      "username": "ahmad",
      "email": "ahmad@example.com",
      "role": { "id": 2, "name": "operator" },
      "permissions": [
        "accommodation:create",
        "accommodation:read",
        "accommodation:update",
        "accommodation:delete",
        "activity:create",
        ...
      ]
    }
  }
}
```

### 4.2 What the Frontend Stores

```typescript
// StorageService stores:
localStorage.setItem("token", response.data.token);
localStorage.setItem("user", JSON.stringify(response.data.user));

// AuthService exposes:
currentUser$: Observable<User | null>; // includes role + permissions
isAuthenticated$: Observable<boolean>;
```

### 4.3 Updated User Interface

```typescript
export interface Role {
  id: number;
  name: "admin" | "operator" | "tourist" | "association";
}

export interface User {
  id: number;
  name: string;
  username: string;
  email: string;
  role: Role;
  permissions: string[]; // e.g., ["accommodation:create", "activity:read"]
}
```

### 4.4 PermissionService (New)

```typescript
@Injectable({ providedIn: "root" })
export class PermissionService {
  constructor(private authService: AuthService) {}

  /**
   * Check if the current user has a specific permission
   */
  hasPermission(code: string): boolean {
    const user = this.authService.currentUser;
    if (!user) return false;
    if (user.role?.name === "admin") return true; // admin bypass
    return user.permissions?.includes(code) ?? false;
  }

  /**
   * Check if the current user has ANY of the given permissions
   */
  hasAnyPermission(codes: string[]): boolean {
    return codes.some((code) => this.hasPermission(code));
  }

  /**
   * Check if current user has a specific role
   */
  hasRole(roleName: string): boolean {
    return this.authService.currentUser?.role?.name === roleName;
  }
}
```

### 4.5 Route Guards

#### 4.5.1 `authGuard` (Updated)

```typescript
export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated) {
    return true;
  }
  router.navigate(["/login"]);
  return false;
};
```

#### 4.5.2 `roleGuard` (New)

```typescript
export const roleGuard = (...allowedRoles: string[]): CanActivateFn => {
  return () => {
    const permissionService = inject(PermissionService);
    const router = inject(Router);

    const hasRole = allowedRoles.some((role) =>
      permissionService.hasRole(role),
    );
    if (hasRole) return true;

    router.navigate(["/unauthorized"]);
    return false;
  };
};
```

#### 4.5.3 `permissionGuard` (New)

```typescript
export const permissionGuard = (
  ...requiredPermissions: string[]
): CanActivateFn => {
  return () => {
    const permissionService = inject(PermissionService);
    const router = inject(Router);

    const hasPermission = requiredPermissions.some((p) =>
      permissionService.hasPermission(p),
    );
    if (hasPermission) return true;

    router.navigate(["/unauthorized"]);
    return false;
  };
};
```

#### 4.5.4 Usage in Routes

```typescript
const routes: Routes = [
  // Public routes
  { path: 'login', loadChildren: () => import('./login/login.module')... },
  { path: 'register', loadChildren: () => import('./register/register.module')... },

  // Authenticated routes (any logged-in user)
  {
    path: 'profile',
    loadChildren: () => import('./profile/profile.module')...,
    canActivate: [authGuard]
  },

  // Operator-only routes
  {
    path: 'acco-form',
    loadChildren: () => import('./acco-form/acco-form.module')...,
    canActivate: [authGuard, roleGuard('operator', 'admin')]
  },
  {
    path: 'activity-form',
    loadChildren: () => import('./activity-form/activity-form.module')...,
    canActivate: [authGuard, permissionGuard('activity:create')]
  },

  // Tourist-only routes
  {
    path: 'tourist/activity-booking',
    loadChildren: () => import('./tourist/activity-booking/activity-booking.module')...,
    canActivate: [authGuard, permissionGuard('booking:create')]
  },

  // Admin-only routes
  {
    path: 'admin/roles',
    loadChildren: () => import('./admin/roles/roles.module')...,
    canActivate: [authGuard, roleGuard('admin')]
  },
];
```

### 4.6 Permission Directive (New)

For showing/hiding UI elements based on permissions:

```typescript
@Directive({ selector: "[hasPermission]" })
export class HasPermissionDirective implements OnInit {
  @Input("hasPermission") permission!: string;

  constructor(
    private templateRef: TemplateRef<any>,
    private viewContainer: ViewContainerRef,
    private permissionService: PermissionService,
  ) {}

  ngOnInit(): void {
    if (this.permissionService.hasPermission(this.permission)) {
      this.viewContainer.createEmbeddedView(this.templateRef);
    } else {
      this.viewContainer.clear();
    }
  }
}
```

#### Usage in Templates

```html
<!-- Only show "Add Accommodation" button if user has permission -->
<ion-button *hasPermission="'accommodation:create'" routerLink="/acco-form">
  Add Accommodation
</ion-button>

<!-- Only show delete button if user has permission -->
<ion-button
  *hasPermission="'accommodation:delete'"
  color="danger"
  (click)="delete(item)">
  Delete
</ion-button>

<!-- Show admin panel link only for admin role -->
<ion-item *hasPermission="'role:read'" routerLink="/admin/roles">
  Manage Roles
</ion-item>
```

### 4.7 HTTP Interceptor Updates

The existing interceptor already attaches the Bearer token. Add a **403 handler**:

```typescript
// In HttpInterceptorService.handleError()
case 403:
  message = 'You do not have permission to perform this action';
  // Optionally navigate to /unauthorized
  break;
```

### 4.8 Navigation Menu — Dynamic Based on Permissions

```typescript
// In app.component.ts or sidebar component

interface MenuItem {
  title: string;
  url: string;
  icon: string;
  permission?: string;  // required permission to show this item
}

const allMenuItems: MenuItem[] = [
  { title: 'Dashboard', url: '/home', icon: 'home-outline' },
  { title: 'Accommodations', url: '/accommodations', icon: 'bed-outline', permission: 'accommodation:read' },
  { title: 'Activities', url: '/activities', icon: 'bicycle-outline', permission: 'activity:read' },
  { title: 'Bookings', url: '/bookings', icon: 'calendar-outline', permission: 'booking:read' },
  { title: 'Receipts', url: '/receipts', icon: 'receipt-outline', permission: 'receipt:read' },
  { title: 'Manage Roles', url: '/admin/roles', icon: 'shield-outline', permission: 'role:read' },
];

// Filter menu items based on user's permissions
get visibleMenuItems(): MenuItem[] {
  return this.allMenuItems.filter(item =>
    !item.permission || this.permissionService.hasPermission(item.permission)
  );
}
```

---

## 5. Sequence Diagrams

### 5.1 Login Flow with RBAC

```
User        Frontend            Backend API            AuthService         Database
 │              │                    │                      │                  │
 │── Login ────►│                    │                      │                  │
 │              │── POST /login ────►│                      │                  │
 │              │   {email, pass}    │── login(email,pass) ►│                  │
 │              │                    │                      │── findOne(email) ►│
 │              │                    │                      │   include: Role   │
 │              │                    │                      │   → Permissions   │
 │              │                    │                      │◄── user+role+perms│
 │              │                    │                      │                  │
 │              │                    │                      │── bcrypt.compare()│
 │              │                    │                      │── build perms[]  │
 │              │                    │                      │── jwt.sign({     │
 │              │                    │                      │     id, username, │
 │              │                    │                      │     role, perms  │
 │              │                    │                      │   })             │
 │              │                    │◄── {token, user} ───│                  │
 │              │◄── 200 ──────────│                      │                  │
 │              │                    │                      │                  │
 │              │── store(token, user with role+perms)     │                  │
 │              │── navigate to dashboard based on role    │                  │
 │◄── Dashboard │                    │                      │                  │
```

### 5.2 Protected Request Flow

```
User        Frontend             Backend API          Middleware Chain        Controller
 │              │                     │                      │                    │
 │── Action ───►│                     │                      │                    │
 │              │── GET /api/accom ──►│                      │                    │
 │              │   Auth: Bearer JWT  │── authenticate() ──►│                    │
 │              │                     │                      │── verify JWT       │
 │              │                     │                      │── req.user = {     │
 │              │                     │                      │     id, role,      │
 │              │                     │                      │     permissions[]  │
 │              │                     │                      │   }               │
 │              │                     │── authorize() ──────►│                    │
 │              │                     │   ('accom:read')     │── check perms[]   │
 │              │                     │                      │── ✅ found         │
 │              │                     │                      │── next() ─────────►│
 │              │                     │                      │                    │── handle
 │              │◄── 200 {data} ─────│◄─────────────────────│◄── response ──────│
 │◄── Render ──│                     │                      │                    │
```

### 5.3 Forbidden Request Flow

```
User        Frontend             Backend API          authorize()
 │              │                     │                    │
 │── Delete ───►│                     │                    │
 │  (tourist)   │── DELETE /accom/5 ─►│                    │
 │              │   Auth: Bearer JWT  │── authenticate() ──► ✅ valid token
 │              │                     │── authorize() ─────►│
 │              │                     │   ('accom:delete')  │── check perms[]
 │              │                     │                     │── ❌ not found
 │              │◄── 403 Forbidden ──│◄── 403 response ───│
 │              │                     │                    │
 │              │── show toast: "You do not have permission"│
 │◄── Toast ───│                     │                    │
```

---

## 6. File Inventory

### 6.1 New Backend Files

| File                                               | Layer      | Purpose                                    |
| -------------------------------------------------- | ---------- | ------------------------------------------ |
| `models/roleModel.js`                              | Model      | Role schema definition                     |
| `models/permissionModel.js`                        | Model      | Permission schema definition               |
| `models/rolePermissionModel.js`                    | Model      | Join table model                           |
| `services/roleService.js`                          | Service    | Role CRUD + permission assignment          |
| `services/permissionService.js`                    | Service    | Permission queries                         |
| `services/authService.js`                          | Service    | Unified login with role/permission loading |
| `controllers/roleController.js`                    | Controller | Role management endpoints                  |
| `controllers/permissionController.js`              | Controller | Permission listing endpoints               |
| `controllers/authController.js`                    | Controller | Unified login/register                     |
| `routes/roleRoutes.js`                             | Route      | Role management routes                     |
| `routes/permissionRoutes.js`                       | Route      | Permission routes                          |
| `routes/authRoutes.js`                             | Route      | Login/register routes                      |
| `middleware/authorize.js`                          | Middleware | Permission + ownership checks              |
| `migrations/...-create-roles-table.js`             | Migration  | Roles table                                |
| `migrations/...-create-permissions-table.js`       | Migration  | Permissions table                          |
| `migrations/...-create-roles-permissions-table.js` | Migration  | Join table                                 |
| `migrations/...-add-role-id-to-users.js`           | Migration  | FK on users table                          |
| `seeders/...-seed-roles.js`                        | Seeder     | Default roles                              |
| `seeders/...-seed-permissions.js`                  | Seeder     | Default permissions                        |
| `seeders/...-seed-role-permissions.js`             | Seeder     | Default role→permission mappings           |

### 6.2 Modified Backend Files

| File                     | Change                                                                        |
| ------------------------ | ----------------------------------------------------------------------------- |
| `models/userModel.js`    | Add `role_id` field + `User.belongsTo(Role)`                                  |
| `models/associations.js` | Add Role ↔ Permission ↔ User associations                                     |
| `middleware/auth.js`     | No logic change — JWT payload is larger but `authenticate` already handles it |
| `server.js`              | Register new route groups (`/api/auth`, `/api/roles`, `/api/permissions`)     |
| All existing route files | Add `authenticate` + `authorize(permission)` middleware to protected routes   |

### 6.3 New Frontend Files

| File                                     | Layer     | Purpose                                 |
| ---------------------------------------- | --------- | --------------------------------------- |
| `services/permission.service.ts`         | Service   | Permission checking logic               |
| `guards/role.guard.ts`                   | Guard     | Role-based route guard                  |
| `guards/permission.guard.ts`             | Guard     | Permission-based route guard            |
| `directives/has-permission.directive.ts` | Directive | Template element show/hide              |
| `shared/shared.module.ts`                | Module    | Export directive for use across modules |
| `pages/unauthorized/`                    | Page      | "Access Denied" page                    |

### 6.4 Modified Frontend Files

| File                                   | Change                                                                |
| -------------------------------------- | --------------------------------------------------------------------- |
| `services/auth.service.ts`             | Update `User` interface, store role+permissions, unified login method |
| `services/storage.service.ts`          | Store/retrieve permissions array                                      |
| `auth.guard.ts`                        | Use `AuthService.isAuthenticated` instead of raw `localStorage`       |
| `app-routing.module.ts`                | Apply `roleGuard`/`permissionGuard` to routes                         |
| `services/http-interceptor.service.ts` | Handle 403 responses                                                  |
| `app.module.ts`                        | Import `SharedModule` for directive                                   |
| Various component templates            | Add `*hasPermission` directives to buttons/menus                      |

---

## 7. Security Considerations

| Threat                                      | Mitigation                                                                                                                                                                                                |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **JWT tampering**                           | JWT is signed with `JWT_SECRET`; any modification invalidates the token                                                                                                                                   |
| **Permission spoofing**                     | Permissions in JWT are server-generated; frontend checks are for UX only; backend always re-validates                                                                                                     |
| **Token theft**                             | Use HTTPS in production; token expires in 24h; no refresh token (for now)                                                                                                                                 |
| **Privilege escalation**                    | Backend `authorize()` middleware enforces permissions on every request; frontend guards are defense-in-depth only                                                                                         |
| **IDOR (Insecure Direct Object Reference)** | `authorizeOwnership()` middleware validates the requesting user owns the resource                                                                                                                         |
| **Mass assignment**                         | `role_id` should NEVER be accepted from request body during registration; only admin can assign roles                                                                                                     |
| **Permission cache staleness**              | If admin changes a role's permissions, existing JWTs retain old permissions until they expire. Acceptable trade-off for 24h tokens. For immediate revocation, add a token blacklist (future enhancement). |

> **Critical Principle**: The frontend NEVER makes authorization decisions. It only uses permissions to optimize the UI (hide buttons, disable routes). The backend is the **sole authority** — every protected endpoint must independently verify permissions via middleware.

---

## 8. Implementation Order

| Phase                          | Tasks                                                                                                                   | Dependencies           |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| **1. Database**                | Create migrations for `roles`, `permissions`, `roles_permissions` tables. Add `role_id` to users table.                 | None                   |
| **2. Models**                  | Create `roleModel.js`, `permissionModel.js`, `rolePermissionModel.js`. Update `userModel.js`. Update `associations.js`. | Phase 1                |
| **3. Seeders**                 | Seed default roles, permissions, and role-permission mappings.                                                          | Phase 2                |
| **4. Services**                | Create `roleService.js`, `permissionService.js`, `authService.js`.                                                      | Phase 2                |
| **5. Middleware**              | Create `authorize.js` middleware.                                                                                       | Phase 4                |
| **6. Controllers + Routes**    | Create `authController.js`, `roleController.js`, `permissionController.js` + routes.                                    | Phase 4, 5             |
| **7. Protect existing routes** | Add `authenticate` + `authorize` to all existing route files.                                                           | Phase 5, 6             |
| **8. Frontend: Auth**          | Update `AuthService`, `StorageService`, `User` interface. Create `PermissionService`.                                   | Phase 6 (backend done) |
| **9. Frontend: Guards**        | Create `roleGuard`, `permissionGuard`. Update `authGuard`. Update routing.                                              | Phase 8                |
| **10. Frontend: Directive**    | Create `HasPermissionDirective`. Apply to templates.                                                                    | Phase 8                |
| **11. Frontend: UX**           | Dynamic menus, unauthorized page, 403 interceptor handling.                                                             | Phase 9, 10            |

---

## 9. Verification Checklist

### Backend

- [x] Migrations run successfully — `roles`, `permissions`, `roles_permissions` tables created
- [x] Seeders populate default roles, permissions, and mappings
- [x] `POST /api/auth/login` returns `{ token, user: { role, permissions[] } }`
- [x] JWT payload includes `role` and `permissions[]`
- [x] Protected endpoint without token → `401`
- [x] Protected endpoint with valid token but insufficient permission → `403`
- [x] Protected endpoint with valid token and correct permission → `200`
- [x] Admin user bypasses all permission checks
- [x] Ownership check: operator can only update their own accommodations
- [x] `role_id` cannot be set via registration endpoint (defaults to tourist)

### Frontend

- [x] Login stores role + permissions in storage
- [x] `PermissionService.hasPermission()` returns correct boolean
- [x] `roleGuard` blocks tourist from operator-only routes
- [x] `permissionGuard` blocks users without the required permission
- [x] `*hasPermission` directive hides/shows elements correctly
- [x] 403 response shows appropriate toast/error message
- [x] Navigation menu items filtered by permissions
- [x] Unauthorized page renders for blocked routes
