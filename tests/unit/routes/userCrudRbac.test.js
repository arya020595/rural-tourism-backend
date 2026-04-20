const express = require("express");
const request = require("supertest");
const { generateToken } = require("../../../middleware/auth");

// ── Service mocks ──────────────────────────────────────────────────────────
const mockGetAllUsers = jest.fn();
const mockGetUserById = jest.fn();
const mockCreateUser = jest.fn();
const mockUpdateUser = jest.fn();
const mockUpdateUserProfile = jest.fn();
const mockDeleteUser = jest.fn();
const mockSearchUsers = jest.fn();

jest.mock("../../../middleware/uploadLogo", () => ({
  fields: () => (req, res, next) => next(),
}));

jest.mock("../../../services/userService", () => ({
  getAllUsers: (...args) => mockGetAllUsers(...args),
  getUserById: (...args) => mockGetUserById(...args),
  createUser: (...args) => mockCreateUser(...args),
  updateUser: (...args) => mockUpdateUser(...args),
  updateUserProfile: (...args) => mockUpdateUserProfile(...args),
  deleteUser: (...args) => mockDeleteUser(...args),
  searchUsers: (...args) => mockSearchUsers(...args),
}));

jest.mock("../../../services/authService", () => ({
  login: jest.fn(),
  register: jest.fn(),
}));

const mockRoleFindOne = jest.fn();
jest.mock("../../../models/roleModel", () => ({
  findOne: (...args) => mockRoleFindOne(...args),
}));

const userRoutes = require("../../../routes/userRoutes");

// ── Helpers ────────────────────────────────────────────────────────────────
const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use("/api/users", userRoutes);
  // Global error handler matching server.js pattern
  app.use((err, req, res, _next) => {
    res.status(err.status || 500).json({
      success: false,
      message: err.message,
    });
  });
  return app;
};

/**
 * Generate a JWT token with specified permissions & role.
 */
const makeToken = (permissions = [], role = "operator_admin", overrides = {}) =>
  generateToken({
    id: 100,
    unified_user_id: 100,
    user_type: "operator",
    username: "test_user",
    role,
    permissions,
    ...overrides,
  });

const ADMIN_TOKEN = makeToken([], "superadmin");

const USER_WITH_ALL_PERMS = makeToken(
  ["user:read", "user:create", "user:update", "user:delete"],
  "operator_admin",
  { company_id: 1 },
);

const USER_WITH_READ_ONLY = makeToken(["user:read"], "operator_admin", {
  company_id: 1,
});

const USER_WITH_NO_USER_PERMS = makeToken(
  ["activity:read", "booking:read"],
  "operator_admin",
);

const USER_WITH_PROFILE_PERMS = makeToken(
  ["profile:read", "profile:update"],
  "operator_admin",
);

// ── Sample data ────────────────────────────────────────────────────────────
const sampleUser = {
  id: 1,
  name: "John Doe",
  username: "johndoe",
  email: "john@example.com",
  association_id: null,
  role_id: 2,
  company_id: 1,
  role: { id: 2, name: "operator_admin" },
  association: null,
  company: null,
  created_at: "2026-04-20T00:00:00.000Z",
  updated_at: "2026-04-20T00:00:00.000Z",
  toJSON() {
    return { ...this };
  },
};

const sampleUser2 = {
  id: 2,
  name: "Jane Smith",
  username: "janesmith",
  email: "jane@example.com",
  association_id: null,
  role_id: 3,
  company_id: 1,
  role: { id: 3, name: "tourist" },
  association: null,
  company: null,
  created_at: "2026-04-20T00:00:00.000Z",
  updated_at: "2026-04-20T00:00:00.000Z",
  toJSON() {
    return { ...this };
  },
};

const sampleUserDiffCompany = {
  id: 3,
  name: "Bob Other",
  username: "bobother",
  email: "bob@other.com",
  association_id: null,
  role_id: 2,
  company_id: 2,
  role: { id: 2, name: "operator_admin" },
  association: null,
  company: null,
  created_at: "2026-04-20T00:00:00.000Z",
  updated_at: "2026-04-20T00:00:00.000Z",
  toJSON() {
    return { ...this };
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe("Users API – CRUD & RBAC", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── Authentication ───────────────────────────────────────────────────────
  describe("Authentication", () => {
    test("GET /api/users should return 401 without token", async () => {
      const app = buildApp();
      const res = await request(app).get("/api/users");

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Access denied. No token provided.");
    });

    test("GET /api/users/:id should return 401 without token", async () => {
      const app = buildApp();
      const res = await request(app).get("/api/users/1");

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    test("PUT /api/users/:id should return 401 without token", async () => {
      const app = buildApp();
      const res = await request(app)
        .put("/api/users/1")
        .send({ name: "Updated" });

      expect(res.status).toBe(401);
    });

    test("DELETE /api/users/:id should return 401 without token", async () => {
      const app = buildApp();
      const res = await request(app).delete("/api/users/1");

      expect(res.status).toBe(401);
    });

    test("GET /api/users/search should return 401 without token", async () => {
      const app = buildApp();
      const res = await request(app).get("/api/users/search?name=test");

      expect(res.status).toBe(401);
    });

    test("should return 401 with invalid token", async () => {
      const app = buildApp();
      const res = await request(app)
        .get("/api/users")
        .set("Authorization", "Bearer invalid-token-here");

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  // ── Authorization: user WITH permissions on users module ─────────────────
  describe("User WITH user:* permissions", () => {
    describe("GET /api/users", () => {
      test("should return 200 and list users with user:read", async () => {
        const app = buildApp();
        mockGetAllUsers.mockResolvedValue([sampleUser, sampleUser2]);

        const res = await request(app)
          .get("/api/users")
          .set("Authorization", `Bearer ${USER_WITH_ALL_PERMS}`);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.message).toBe("Users fetched successfully");
        expect(res.body.data).toHaveLength(2);
        expect(res.body.data[0].id).toBe(1);
        expect(res.body.data[1].id).toBe(2);
        expect(mockGetAllUsers).toHaveBeenCalledTimes(1);
      });

      test("should return 200 with read-only permission", async () => {
        const app = buildApp();
        mockGetAllUsers.mockResolvedValue([]);

        const res = await request(app)
          .get("/api/users")
          .set("Authorization", `Bearer ${USER_WITH_READ_ONLY}`);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data).toEqual([]);
      });
    });

    describe("GET /api/users/:id", () => {
      test("should return 200 and user data with user:read", async () => {
        const app = buildApp();
        mockGetUserById.mockResolvedValue(sampleUser);

        const res = await request(app)
          .get("/api/users/1")
          .set("Authorization", `Bearer ${USER_WITH_ALL_PERMS}`);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.id).toBe(1);
        expect(res.body.data.username).toBe("johndoe");
        expect(mockGetUserById).toHaveBeenCalledWith("1");
      });

      test("should return 404 when user not found", async () => {
        const app = buildApp();
        const error = new Error("User not found");
        error.statusCode = 404;
        mockGetUserById.mockRejectedValue(error);

        const res = await request(app)
          .get("/api/users/999")
          .set("Authorization", `Bearer ${USER_WITH_ALL_PERMS}`);

        expect(res.status).toBe(404);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toBe("User not found");
      });
    });

    describe("POST /api/users", () => {
      test("should return 201 and created user", async () => {
        const app = buildApp();
        mockRoleFindOne.mockResolvedValue({ id: 5, name: "operator_staff" });
        mockCreateUser.mockResolvedValue(sampleUser);

        const res = await request(app)
          .post("/api/users")
          .set("Authorization", `Bearer ${USER_WITH_ALL_PERMS}`)
          .send({
            name: "John Doe",
            username: "johndoe",
            email: "john@example.com",
            password: "secure123",
          });

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.message).toBe("User created successfully");
        expect(res.body.data.username).toBe("johndoe");
        expect(mockCreateUser).toHaveBeenCalledWith({
          name: "John Doe",
          username: "johndoe",
          email: "john@example.com",
          password: "secure123",
          role_id: 5,
          association_id: null,
          company_id: 1,
        });
      });

      test("should return 400 for missing required fields", async () => {
        const app = buildApp();
        mockRoleFindOne.mockResolvedValue({ id: 5, name: "operator_staff" });
        const error = new Error(
          "name, username, email, and password are required",
        );
        error.statusCode = 400;
        mockCreateUser.mockRejectedValue(error);

        const res = await request(app)
          .post("/api/users")
          .set("Authorization", `Bearer ${USER_WITH_ALL_PERMS}`)
          .send({
            username: "johndoe",
          });

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
      });

      test("should return 409 for duplicate username/email", async () => {
        const app = buildApp();
        mockRoleFindOne.mockResolvedValue({ id: 5, name: "operator_staff" });
        const error = new Error("Username or email already exists");
        error.statusCode = 409;
        mockCreateUser.mockRejectedValue(error);

        const res = await request(app)
          .post("/api/users")
          .set("Authorization", `Bearer ${USER_WITH_ALL_PERMS}`)
          .send({
            name: "John Doe",
            username: "johndoe",
            email: "john@example.com",
            password: "secure123",
          });

        expect(res.status).toBe(409);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toBe("Username or email already exists");
      });
    });

    describe("PUT /api/users/:id", () => {
      test("should return 200 and updated user with user:update", async () => {
        const app = buildApp();
        const updatedUser = { ...sampleUser, name: "John Updated" };
        updatedUser.toJSON = () => ({ ...updatedUser });
        mockGetUserById.mockResolvedValue(sampleUser);
        mockUpdateUser.mockResolvedValue(updatedUser);

        const res = await request(app)
          .put("/api/users/1")
          .set("Authorization", `Bearer ${USER_WITH_ALL_PERMS}`)
          .send({ name: "John Updated" });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.message).toBe("User updated successfully");
        expect(mockUpdateUser).toHaveBeenCalled();
      });

      test("should return 404 when updating non-existing user", async () => {
        const app = buildApp();
        const error = new Error("User not found");
        error.statusCode = 404;
        mockGetUserById.mockRejectedValue(error);

        const res = await request(app)
          .put("/api/users/999")
          .set("Authorization", `Bearer ${USER_WITH_ALL_PERMS}`)
          .send({ name: "Ghost" });

        expect(res.status).toBe(404);
        expect(res.body.success).toBe(false);
      });

      test("should return 409 when username already taken", async () => {
        const app = buildApp();
        const error = new Error("Username already taken");
        error.statusCode = 409;
        mockGetUserById.mockResolvedValue(sampleUser);
        mockUpdateUser.mockRejectedValue(error);

        const res = await request(app)
          .put("/api/users/1")
          .set("Authorization", `Bearer ${USER_WITH_ALL_PERMS}`)
          .send({ username: "existing_user" });

        expect(res.status).toBe(409);
        expect(res.body.message).toBe("Username already taken");
      });
    });

    describe("DELETE /api/users/:id", () => {
      test("should return 200 with user:delete", async () => {
        const app = buildApp();
        mockGetUserById.mockResolvedValue(sampleUser);
        mockDeleteUser.mockResolvedValue();

        const res = await request(app)
          .delete("/api/users/1")
          .set("Authorization", `Bearer ${USER_WITH_ALL_PERMS}`);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.message).toBe("User deleted successfully");
        expect(mockDeleteUser).toHaveBeenCalledWith("1");
      });

      test("should return 403 when deleting user from different company", async () => {
        const app = buildApp();
        mockGetUserById.mockResolvedValue(sampleUserDiffCompany);

        const res = await request(app)
          .delete("/api/users/3")
          .set("Authorization", `Bearer ${USER_WITH_ALL_PERMS}`);

        expect(res.status).toBe(403);
        expect(res.body.success).toBe(false);
        expect(mockDeleteUser).not.toHaveBeenCalled();
      });

      test("should return 404 when deleting non-existing user", async () => {
        const app = buildApp();
        const error = new Error("User not found");
        error.statusCode = 404;
        mockGetUserById.mockRejectedValue(error);

        const res = await request(app)
          .delete("/api/users/999")
          .set("Authorization", `Bearer ${USER_WITH_ALL_PERMS}`);

        expect(res.status).toBe(404);
        expect(res.body.success).toBe(false);
      });
    });

    describe("GET /api/users/search", () => {
      test("should return 200 with matching users", async () => {
        const app = buildApp();
        mockSearchUsers.mockResolvedValue([sampleUser]);

        const res = await request(app)
          .get("/api/users/search?name=John")
          .set("Authorization", `Bearer ${USER_WITH_ALL_PERMS}`);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data).toHaveLength(1);
        expect(mockSearchUsers).toHaveBeenCalledWith("John", { company_id: 1 });
      });

      test("should return empty array when no match", async () => {
        const app = buildApp();
        mockSearchUsers.mockResolvedValue([]);

        const res = await request(app)
          .get("/api/users/search?name=nonexistent")
          .set("Authorization", `Bearer ${USER_WITH_ALL_PERMS}`);

        expect(res.status).toBe(200);
        expect(res.body.data).toEqual([]);
      });
    });
  });

  // ── Authorization: admin role (bypass all permissions) ───────────────────
  describe("Admin role (bypass)", () => {
    test("GET /api/users should return 200 for admin", async () => {
      const app = buildApp();
      mockGetAllUsers.mockResolvedValue([sampleUser]);

      const res = await request(app)
        .get("/api/users")
        .set("Authorization", `Bearer ${ADMIN_TOKEN}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    test("DELETE /api/users/:id should return 200 for admin (no user:delete needed)", async () => {
      const app = buildApp();
      mockGetUserById.mockResolvedValue(sampleUser);
      mockDeleteUser.mockResolvedValue();

      const res = await request(app)
        .delete("/api/users/1")
        .set("Authorization", `Bearer ${ADMIN_TOKEN}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    test("PUT /api/users/:id should return 200 for admin on any user", async () => {
      const app = buildApp();
      const updatedUser = { ...sampleUser, name: "Admin Updated" };
      updatedUser.toJSON = () => ({ ...updatedUser });
      mockGetUserById.mockResolvedValue(sampleUser);
      mockUpdateUser.mockResolvedValue(updatedUser);

      const res = await request(app)
        .put("/api/users/999")
        .set("Authorization", `Bearer ${ADMIN_TOKEN}`)
        .send({ name: "Admin Updated" });

      expect(res.status).toBe(200);
    });
  });

  // ── Authorization: user WITHOUT permissions on users module ──────────────
  describe("User WITHOUT user:* permissions", () => {
    test("GET /api/users should return 403", async () => {
      const app = buildApp();

      const res = await request(app)
        .get("/api/users")
        .set("Authorization", `Bearer ${USER_WITH_NO_USER_PERMS}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe(
        "Forbidden. You do not have permission to perform this action.",
      );
      expect(res.body.data.required).toEqual(["user:read"]);
      expect(res.body.data.your_role).toBe("operator_admin");
      expect(mockGetAllUsers).not.toHaveBeenCalled();
    });

    test("GET /api/users/:id should return 403 without user:read or profile:read", async () => {
      const app = buildApp();

      const res = await request(app)
        .get("/api/users/1")
        .set("Authorization", `Bearer ${USER_WITH_NO_USER_PERMS}`);

      expect(res.status).toBe(403);
      expect(res.body.data.required).toEqual(["user:read", "profile:read"]);
      expect(mockGetUserById).not.toHaveBeenCalled();
    });

    test("PUT /api/users/:id should return 403 without user:update or profile:update", async () => {
      const app = buildApp();

      const res = await request(app)
        .put("/api/users/1")
        .set("Authorization", `Bearer ${USER_WITH_NO_USER_PERMS}`)
        .send({ name: "Hacker" });

      expect(res.status).toBe(403);
      expect(res.body.data.required).toEqual(["user:update", "profile:update"]);
      expect(mockUpdateUser).not.toHaveBeenCalled();
    });

    test("DELETE /api/users/:id should return 403 without user:delete", async () => {
      const app = buildApp();

      const res = await request(app)
        .delete("/api/users/1")
        .set("Authorization", `Bearer ${USER_WITH_NO_USER_PERMS}`);

      expect(res.status).toBe(403);
      expect(res.body.data.required).toEqual(["user:delete"]);
      expect(mockDeleteUser).not.toHaveBeenCalled();
    });

    test("GET /api/users/search should return 403 without user:read", async () => {
      const app = buildApp();

      const res = await request(app)
        .get("/api/users/search?name=test")
        .set("Authorization", `Bearer ${USER_WITH_NO_USER_PERMS}`);

      expect(res.status).toBe(403);
      expect(mockSearchUsers).not.toHaveBeenCalled();
    });
  });

  // ── Ownership: profile:read / profile:update (own resource only) ────────
  describe("Ownership-based access (profile:read / profile:update)", () => {
    test("GET /api/users/:id should allow own resource with profile:read", async () => {
      const app = buildApp();
      const ownUser = { ...sampleUser, id: 100 };
      ownUser.toJSON = () => ({ ...ownUser });
      mockGetUserById.mockResolvedValue(ownUser);

      const res = await request(app)
        .get("/api/users/100")
        .set("Authorization", `Bearer ${USER_WITH_PROFILE_PERMS}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    test("GET /api/users/:id should return 403 for other user's resource with profile:read only", async () => {
      const app = buildApp();

      const res = await request(app)
        .get("/api/users/999")
        .set("Authorization", `Bearer ${USER_WITH_PROFILE_PERMS}`);

      expect(res.status).toBe(403);
      expect(res.body.message).toBe(
        "Forbidden. You can only access your own resources.",
      );
      expect(mockGetUserById).not.toHaveBeenCalled();
    });

    test("PUT /api/users/:id should allow own resource with profile:update", async () => {
      const app = buildApp();
      const updatedUser = { ...sampleUser, id: 100, name: "Self Updated" };
      updatedUser.toJSON = () => ({ ...updatedUser });
      mockGetUserById.mockResolvedValue(updatedUser);
      mockUpdateUser.mockResolvedValue(updatedUser);

      const res = await request(app)
        .put("/api/users/100")
        .set("Authorization", `Bearer ${USER_WITH_PROFILE_PERMS}`)
        .send({ name: "Self Updated" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    test("PUT /api/users/:id should return 403 for other user's resource with profile:update only", async () => {
      const app = buildApp();

      const res = await request(app)
        .put("/api/users/999")
        .set("Authorization", `Bearer ${USER_WITH_PROFILE_PERMS}`)
        .send({ name: "Hacker" });

      expect(res.status).toBe(403);
      expect(mockUpdateUser).not.toHaveBeenCalled();
    });
  });

  // ── POST /api/users requires authentication ──────────────────────────────
  describe("POST /api/users (requires auth)", () => {
    test("should return 401 without authentication", async () => {
      const app = buildApp();

      const res = await request(app).post("/api/users").send({
        name: "John Doe",
        username: "johndoe",
        email: "john@example.com",
        password: "secure123",
      });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    test("should return 403 without user:create permission", async () => {
      const app = buildApp();

      const res = await request(app)
        .post("/api/users")
        .set("Authorization", `Bearer ${USER_WITH_NO_USER_PERMS}`)
        .send({
          name: "John Doe",
          username: "johndoe",
          email: "john@example.com",
          password: "secure123",
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });

  // ── Response envelope contract ──────────────────────────────────────────
  describe("Response envelope contract", () => {
    test("success responses should have { success: true, message, data }", async () => {
      const app = buildApp();
      mockGetAllUsers.mockResolvedValue([sampleUser]);

      const res = await request(app)
        .get("/api/users")
        .set("Authorization", `Bearer ${ADMIN_TOKEN}`);

      expect(res.body).toHaveProperty("success", true);
      expect(res.body).toHaveProperty("message");
      expect(res.body).toHaveProperty("data");
    });

    test("error responses should have { success: false, message }", async () => {
      const app = buildApp();

      const res = await request(app)
        .get("/api/users")
        .set("Authorization", `Bearer ${USER_WITH_NO_USER_PERMS}`);

      expect(res.body).toHaveProperty("success", false);
      expect(res.body).toHaveProperty("message");
    });

    test("serialized user should include expected fields", async () => {
      const app = buildApp();
      mockGetAllUsers.mockResolvedValue([sampleUser]);

      const res = await request(app)
        .get("/api/users")
        .set("Authorization", `Bearer ${ADMIN_TOKEN}`);

      const user = res.body.data[0];
      expect(user).toHaveProperty("id");
      expect(user).toHaveProperty("name");
      expect(user).toHaveProperty("username");
      expect(user).toHaveProperty("email");
      expect(user).toHaveProperty("role_id");
      expect(user).toHaveProperty("association_id");
      expect(user).toHaveProperty("company_id");
      expect(user).toHaveProperty("role");
      expect(user).toHaveProperty("created_at");
      expect(user).toHaveProperty("updated_at");
      // Should NOT leak password
      expect(user).not.toHaveProperty("password");
      expect(user).not.toHaveProperty("confirm_password");
    });
  });
});
