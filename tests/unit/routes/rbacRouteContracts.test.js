const express = require("express");
const request = require("supertest");
const { generateToken } = require("../../../middleware/auth");

const mockAuthLogin = jest.fn();
const mockAuthRegister = jest.fn();
const mockGetAllRoles = jest.fn();
const mockGetRoleWithPermissions = jest.fn();
const mockAssignPermissionsToRole = jest.fn();
const mockGetAllPermissions = jest.fn();
const mockGetPermissionsByResource = jest.fn();

jest.mock("../../../middleware/uploadLogo", () => ({
  fields: () => (req, res, next) => next(),
}));

jest.mock("../../../services/authService", () => ({
  login: (...args) => mockAuthLogin(...args),
  register: (...args) => mockAuthRegister(...args),
}));

jest.mock("../../../services/roleService", () => ({
  getAllRoles: (...args) => mockGetAllRoles(...args),
  getRoleWithPermissions: (...args) => mockGetRoleWithPermissions(...args),
  assignPermissionsToRole: (...args) => mockAssignPermissionsToRole(...args),
}));

jest.mock("../../../services/permissionService", () => ({
  getAllPermissions: (...args) => mockGetAllPermissions(...args),
  getPermissionsByResource: (...args) => mockGetPermissionsByResource(...args),
}));

const authRoutes = require("../../../routes/authRoutes");
const roleRoutes = require("../../../routes/roleRoutes");
const permissionRoutes = require("../../../routes/permissionRoutes");

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use("/api/auth", authRoutes);
  app.use("/api/roles", roleRoutes);
  app.use("/api/permissions", permissionRoutes);
  return app;
};

const makeToken = (permissions = [], role = "operator_admin") =>
  generateToken({
    id: 100,
    unified_user_id: 100,
    user_type: "operator",
    username: "test_user",
    role,
    permissions,
  });

describe("RBAC route contracts", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("POST /api/auth/login", () => {
    test("should return canonical login envelope", async () => {
      const app = buildApp();

      mockAuthLogin.mockResolvedValue({
        token: "jwt-token",
        user: {
          id: 1,
          user_type: "operator",
          unified_user_id: 1,
          username: "operator1",
          email: "operator@example.com",
          role: { id: 2, name: "operator_admin" },
          permissions: ["activity:read"],
        },
      });

      const response = await request(app).post("/api/auth/login").send({
        identifier: "operator1",
        password: "secret",
        user_type: "operator",
      });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        message: "Login successful",
        data: {
          token: "jwt-token",
          user: {
            id: 1,
            user_type: "operator",
            unified_user_id: 1,
            username: "operator1",
            email: "operator@example.com",
            role: { id: 2, name: "operator_admin" },
            permissions: ["activity:read"],
          },
        },
      });
      expect(mockAuthLogin).toHaveBeenCalledWith({
        identifier: "operator1",
        password: "secret",
        allowedUserTypes: ["operator"],
      });
    });

    test("should return 400 for invalid user_type", async () => {
      const app = buildApp();

      const response = await request(app).post("/api/auth/login").send({
        identifier: "operator1",
        password: "secret",
        user_type: "invalid",
      });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("Invalid user_type");
      expect(mockAuthLogin).not.toHaveBeenCalled();
    });

    test("should return service error status codes", async () => {
      const app = buildApp();
      const error = new Error("Invalid username/email or password");
      error.statusCode = 401;
      mockAuthLogin.mockRejectedValue(error);

      const response = await request(app).post("/api/auth/login").send({
        identifier: "operator1",
        password: "wrong",
      });

      expect(response.status).toBe(401);
      expect(response.body).toEqual({
        success: false,
        message: "Invalid username/email or password",
      });
    });
  });

  describe("protected RBAC routes", () => {
    test("GET /api/roles should return 401 without token", async () => {
      const app = buildApp();

      const response = await request(app).get("/api/roles");

      expect(response.status).toBe(401);
      expect(response.body.message).toBe("Access denied. No token provided.");
    });

    test("GET /api/roles should return 403 with insufficient permission", async () => {
      const app = buildApp();
      const token = makeToken(["activity:read"], "operator_admin");

      const response = await request(app)
        .get("/api/roles")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.data.required).toEqual(["role:read"]);
    });

    test("GET /api/roles should return 200 with role:read", async () => {
      const app = buildApp();
      const token = makeToken(["role:read"], "operator_admin");
      mockGetAllRoles.mockResolvedValue([
        { id: 1, name: "superadmin", permissions: [] },
      ]);

      const response = await request(app)
        .get("/api/roles")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual([
        { id: 1, name: "superadmin", permissions: [] },
      ]);
    });

    test("GET /api/permissions should return 200 with permission:read", async () => {
      const app = buildApp();
      const token = makeToken(["permission:read"], "operator_admin");
      mockGetAllPermissions.mockResolvedValue([
        { id: 1, code: "activity:read" },
        { id: 2, code: "booking:update" },
      ]);

      const response = await request(app)
        .get("/api/permissions")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
    });
  });
});
