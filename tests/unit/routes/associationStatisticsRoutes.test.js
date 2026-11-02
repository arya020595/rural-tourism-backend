const express = require("express");
const request = require("supertest");
const { generateToken } = require("../../../middleware/auth");

const mockGetMyAssociationStats = jest.fn();
const mockGetAssociationMember = jest.fn();

jest.mock("../../../services/dashboardService", () => ({
  getMyAssociationStats: (...args) => mockGetMyAssociationStats(...args),
  getAssociationMember: (...args) => mockGetAssociationMember(...args),
}));

const dashboardRoutes = require("../../../routes/dashboardRoutes");

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use("/api/dashboard", dashboardRoutes);
  return app;
};

const token = (permissions, role, extra = {}) =>
  generateToken({ id: 117, unified_user_id: 117, user_type: "association", role, permissions, ...extra });

const KTA = token(["association:read"], "association", { association_id: 7 });
const KOBETA = token(["association:read"], "association", { association_id: 1 });
const SUPERADMIN = token(["*:*"], "superadmin");
const OPERATOR = token(["booking:read"], "operator_admin", { company_id: 42 });

const member = (status = "approved", associationId = 7) => ({
  company: {
    id: 42,
    company_name: "KLK Lodge",
    registration_status: status,
    created_at: new Date("2026-09-15T01:45:28Z"),
    motac_license_file: "/uploads/companies/motac.pdf",
  },
  owner: { id: 900, name: "Owner", username: "owner", email: "o@example.com", association_id: associationId },
  association: { id: associationId, name: "KIULU TOURISM ASSOCIATION (KTA)" },
  reviewer: null,
});

describe("Association statistics routes", () => {
  let app;
  beforeEach(() => {
    app = buildApp();
    jest.clearAllMocks();
    mockGetMyAssociationStats.mockResolvedValue({
      association: { id: 7, name: "KTA" },
      totals: { totalBookings: 3 },
      members: [],
    });
    mockGetAssociationMember.mockResolvedValue(member());
  });

  test("stats need association:read", async () => {
    const res = await request(app).get("/api/dashboard/my-association-stats").set("Authorization", `Bearer ${OPERATOR}`);
    expect(res.status).toBe(403);
    expect(mockGetMyAssociationStats).not.toHaveBeenCalled();
  });

  test("stats are loaded for the caller's own association", async () => {
    const res = await request(app)
      .get("/api/dashboard/my-association-stats?from=2026-10-01&to=2026-10-31")
      .set("Authorization", `Bearer ${KTA}`);
    expect(res.status).toBe(200);
    expect(res.body.data.association.id).toBe(7);
    const [user, from, to] = mockGetMyAssociationStats.mock.calls[0];
    expect(user.association_id).toBe(7);
    expect([from, to]).toEqual(["2026-10-01", "2026-10-31"]);
  });

  test("stats reject a half date range", async () => {
    const res = await request(app)
      .get("/api/dashboard/my-association-stats?from=2026-10-01")
      .set("Authorization", `Bearer ${KTA}`);
    expect(res.status).toBe(400);
  });

  test("member profile of the caller's association is serialized", async () => {
    const res = await request(app).get("/api/dashboard/my-association-members/42").set("Authorization", `Bearer ${KTA}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      company_id: 42,
      company_name: "KLK Lodge",
      owner: { name: "Owner", email: "o@example.com" },
      documents: { motac_license_file: "/uploads/companies/motac.pdf" },
    });
    expect(res.body.data.owner.id).toBeUndefined();
  });

  test("member of another association → 403", async () => {
    const res = await request(app).get("/api/dashboard/my-association-members/42").set("Authorization", `Bearer ${KOBETA}`);
    expect(res.status).toBe(403);
  });

  test("pending / rejected companies are not members yet → 403", async () => {
    mockGetAssociationMember.mockResolvedValue(member("pending"));
    const res = await request(app).get("/api/dashboard/my-association-members/42").set("Authorization", `Bearer ${KTA}`);
    expect(res.status).toBe(403);
  });

  test("superadmin can open any member profile", async () => {
    mockGetAssociationMember.mockResolvedValue(member("approved", 5));
    const res = await request(app).get("/api/dashboard/my-association-members/42").set("Authorization", `Bearer ${SUPERADMIN}`);
    expect(res.status).toBe(200);
  });
});
