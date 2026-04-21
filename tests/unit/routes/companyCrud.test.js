const express = require("express");
const request = require("supertest");
const { generateToken } = require("../../../middleware/auth");

// ── Service mocks ──────────────────────────────────────────────────────────
const mockGetCompanyById = jest.fn();
const mockUpdateCompany = jest.fn();

jest.mock("../../../middleware/uploadLogo", () => ({
  fields: () => (req, res, next) => next(),
}));

jest.mock("../../../services/companyService", () => ({
  getCompanyById: (...args) => mockGetCompanyById(...args),
  updateCompany: (...args) => mockUpdateCompany(...args),
}));

const companyRoutes = require("../../../routes/companyRoutes");

// ── Helpers ────────────────────────────────────────────────────────────────
const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use("/api/companies", companyRoutes);
  app.use((err, req, res, _next) => {
    res.status(err.status || 500).json({
      success: false,
      message: err.message,
    });
  });
  return app;
};

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

const SUPERADMIN_TOKEN = makeToken([], "superadmin");

const OPERATOR_ADMIN_TOKEN = makeToken(
  [
    "user:read",
    "user:create",
    "user:update",
    "user:delete",
    "profile:read",
    "profile:update",
  ],
  "operator_admin",
  { company_id: 1 },
);

const OPERATOR_STAFF_TOKEN = makeToken(
  ["profile:read", "profile:update", "accommodation:read"],
  "operator_staff",
  { company_id: 1 },
);

const OTHER_COMPANY_TOKEN = makeToken(
  ["profile:read", "profile:update"],
  "operator_admin",
  { company_id: 2 },
);

const TOURIST_TOKEN = makeToken(
  ["profile:read", "profile:update", "booking:read"],
  "tourist",
  {},
);

// ── Sample data ────────────────────────────────────────────────────────────
const sampleCompany = {
  id: 1,
  company_name: "Test Company",
  address: "123 Main St",
  email: "company@example.com",
  location: "Kuala Lumpur",
  postcode: "50000",
  total_fulltime_staff: 5,
  total_partime_staff: 3,
  contact_no: "0123456789",
  operator_logo_image: null,
  motac_license_file: null,
  trading_operation_license: null,
  homestay_certificate: null,
  created_at: "2026-04-20T00:00:00.000Z",
  updated_at: "2026-04-20T00:00:00.000Z",
  toJSON() {
    return { ...this };
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe("Companies API – Read & Update", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── Authentication ─────────────────────────────────────────────────────
  describe("Authentication (401)", () => {
    test("GET /api/companies/:id should return 401 without token", async () => {
      const app = buildApp();
      const res = await request(app).get("/api/companies/1");

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Access denied. No token provided.");
    });

    test("PUT /api/companies/:id should return 401 without token", async () => {
      const app = buildApp();
      const res = await request(app)
        .put("/api/companies/1")
        .send({ company_name: "Updated" });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  // ── GET /api/companies/:id ─────────────────────────────────────────────
  describe("GET /api/companies/:id", () => {
    test("should return 200 for superadmin on any company", async () => {
      mockGetCompanyById.mockResolvedValue(sampleCompany);
      const app = buildApp();

      const res = await request(app)
        .get("/api/companies/1")
        .set("Authorization", `Bearer ${SUPERADMIN_TOKEN}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.company_name).toBe("Test Company");
    });

    test("should return 200 for operator_admin on own company", async () => {
      mockGetCompanyById.mockResolvedValue(sampleCompany);
      const app = buildApp();

      const res = await request(app)
        .get("/api/companies/1")
        .set("Authorization", `Bearer ${OPERATOR_ADMIN_TOKEN}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    test("should return 403 for operator_staff (not allowed)", async () => {
      mockGetCompanyById.mockResolvedValue(sampleCompany);
      const app = buildApp();

      const res = await request(app)
        .get("/api/companies/1")
        .set("Authorization", `Bearer ${OPERATOR_STAFF_TOKEN}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    test("should return 403 for tourist", async () => {
      mockGetCompanyById.mockResolvedValue(sampleCompany);
      const app = buildApp();

      const res = await request(app)
        .get("/api/companies/1")
        .set("Authorization", `Bearer ${TOURIST_TOKEN}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    test("should return 403 for operator_admin on other company", async () => {
      mockGetCompanyById.mockResolvedValue(sampleCompany);
      const app = buildApp();

      const res = await request(app)
        .get("/api/companies/1")
        .set("Authorization", `Bearer ${OTHER_COMPANY_TOKEN}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain("your own company");
    });

    test("should return 404 when company not found", async () => {
      const { NotFoundError } = require("../../../services/errors/AppError");
      mockGetCompanyById.mockRejectedValue(
        new NotFoundError("Company not found"),
      );
      const app = buildApp();

      const res = await request(app)
        .get("/api/companies/999")
        .set("Authorization", `Bearer ${SUPERADMIN_TOKEN}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    test("serialized response should include expected fields", async () => {
      mockGetCompanyById.mockResolvedValue(sampleCompany);
      const app = buildApp();

      const res = await request(app)
        .get("/api/companies/1")
        .set("Authorization", `Bearer ${SUPERADMIN_TOKEN}`);

      const data = res.body.data;
      expect(data).toHaveProperty("id");
      expect(data).toHaveProperty("company_name");
      expect(data).toHaveProperty("address");
      expect(data).toHaveProperty("email");
      expect(data).toHaveProperty("location");
      expect(data).toHaveProperty("postcode");
      expect(data).toHaveProperty("contact_no");
      expect(data).toHaveProperty("total_fulltime_staff");
      expect(data).toHaveProperty("total_partime_staff");
      expect(data).not.toHaveProperty("password");
    });
  });

  // ── PUT /api/companies/:id ─────────────────────────────────────────────
  describe("PUT /api/companies/:id", () => {
    const updatedCompany = {
      ...sampleCompany,
      company_name: "Updated Company",
      toJSON() {
        return { ...this };
      },
    };

    test("should return 200 for superadmin", async () => {
      mockGetCompanyById.mockResolvedValue(sampleCompany);
      mockUpdateCompany.mockResolvedValue(updatedCompany);
      const app = buildApp();

      const res = await request(app)
        .put("/api/companies/1")
        .set("Authorization", `Bearer ${SUPERADMIN_TOKEN}`)
        .send({ company_name: "Updated Company" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("Company updated successfully");
    });

    test("should return 200 for operator_admin on own company", async () => {
      mockGetCompanyById.mockResolvedValue(sampleCompany);
      mockUpdateCompany.mockResolvedValue(updatedCompany);
      const app = buildApp();

      const res = await request(app)
        .put("/api/companies/1")
        .set("Authorization", `Bearer ${OPERATOR_ADMIN_TOKEN}`)
        .send({ company_name: "Updated Company" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    test("should return 403 for operator_staff (read-only)", async () => {
      mockGetCompanyById.mockResolvedValue(sampleCompany);
      const app = buildApp();

      const res = await request(app)
        .put("/api/companies/1")
        .set("Authorization", `Bearer ${OPERATOR_STAFF_TOKEN}`)
        .send({ company_name: "Hacked" });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain("your own company");
    });

    test("should return 403 for operator_admin on other company", async () => {
      mockGetCompanyById.mockResolvedValue(sampleCompany);
      const app = buildApp();

      const res = await request(app)
        .put("/api/companies/1")
        .set("Authorization", `Bearer ${OTHER_COMPANY_TOKEN}`)
        .send({ company_name: "Hacked" });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    test("should return 404 when company not found", async () => {
      const { NotFoundError } = require("../../../services/errors/AppError");
      mockGetCompanyById.mockRejectedValue(
        new NotFoundError("Company not found"),
      );
      const app = buildApp();

      const res = await request(app)
        .put("/api/companies/999")
        .set("Authorization", `Bearer ${SUPERADMIN_TOKEN}`)
        .send({ company_name: "Updated" });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    test("should pass extracted fields to service", async () => {
      mockGetCompanyById.mockResolvedValue(sampleCompany);
      mockUpdateCompany.mockResolvedValue(updatedCompany);
      const app = buildApp();

      await request(app)
        .put("/api/companies/1")
        .set("Authorization", `Bearer ${SUPERADMIN_TOKEN}`)
        .send({
          company_name: "Updated Company",
          address: "456 New St",
          total_fulltime_staff: 10,
        });

      expect(mockUpdateCompany).toHaveBeenCalledWith(
        "1",
        expect.objectContaining({
          company_name: "Updated Company",
          address: "456 New St",
          total_fulltime_staff: 10,
        }),
      );
    });
  });

  // ── Response envelope ──────────────────────────────────────────────────
  describe("Response envelope contract", () => {
    test("success responses should have { success: true, message, data }", async () => {
      mockGetCompanyById.mockResolvedValue(sampleCompany);
      const app = buildApp();

      const res = await request(app)
        .get("/api/companies/1")
        .set("Authorization", `Bearer ${SUPERADMIN_TOKEN}`);

      expect(res.body).toHaveProperty("success", true);
      expect(res.body).toHaveProperty("message");
      expect(res.body).toHaveProperty("data");
    });

    test("error responses should have { success: false, message }", async () => {
      const { NotFoundError } = require("../../../services/errors/AppError");
      mockGetCompanyById.mockRejectedValue(
        new NotFoundError("Company not found"),
      );
      const app = buildApp();

      const res = await request(app)
        .get("/api/companies/999")
        .set("Authorization", `Bearer ${SUPERADMIN_TOKEN}`);

      expect(res.body).toHaveProperty("success", false);
      expect(res.body).toHaveProperty("message");
    });
  });
});
