const express = require("express");
const request = require("supertest");
const { generateToken } = require("../../../middleware/auth");
const { registrationBlock, daysSince } = require("../../../utils/registrationHelpers");

const mockList = jest.fn();
const mockPendingCount = jest.fn();
const mockGetRegistration = jest.fn();
const mockApprove = jest.fn();
const mockReject = jest.fn();

jest.mock("../../../services/registrationService", () => ({
  list: (...args) => mockList(...args),
  pendingCount: (...args) => mockPendingCount(...args),
  getRegistration: (...args) => mockGetRegistration(...args),
  approve: (...args) => mockApprove(...args),
  reject: (...args) => mockReject(...args),
}));

const registrationRoutes = require("../../../routes/registrationRoutes");

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use("/api/registrations", registrationRoutes);
  return app;
};

const token = (permissions, role, extra = {}) =>
  generateToken({ id: 117, unified_user_id: 117, user_type: "association", role, permissions, ...extra });

const KTA = token(["registration:approve"], "association", { association_id: 7 });
const KOBETA = token(["registration:approve"], "association", { association_id: 1 });
const SUPERADMIN = token(["*:*"], "superadmin");
const OPERATOR = token(["booking:read"], "operator_admin", { company_id: 42 });

const entry = (status = "pending", associationId = 7) => ({
  company: {
    id: 500,
    company_name: "ZZ Homestay",
    registration_status: status,
    registration_submitted_at: new Date(),
    registration_rejection_reason: status === "rejected" ? "No licence" : null,
    motac_license_file: "/uploads/companies/motac.pdf",
  },
  owner: { id: 900, name: "Owner", username: "owner", email: "o@example.com", association_id: associationId },
  association: { id: associationId, name: "KIULU TOURISM ASSOCIATION (KTA)" },
  reviewer: null,
});

describe("registrationHelpers", () => {
  test("pending / rejected block login; approved and old rows don't", () => {
    expect(registrationBlock({ registration_status: "pending" }).code).toBe("REGISTRATION_PENDING");
    const rejected = registrationBlock({ registration_status: "rejected", registration_rejection_reason: "No licence" });
    expect(rejected.code).toBe("REGISTRATION_REJECTED");
    expect(rejected.reason).toBe("No licence");
    expect(rejected.message).toMatch(/No licence/);
    expect(registrationBlock({ registration_status: "approved" })).toBeNull();
    expect(registrationBlock({})).toBeNull();
    expect(registrationBlock(null)).toBeNull();
  });

  test("daysSince counts whole days", () => {
    const now = new Date("2026-10-30T10:00:00Z");
    expect(daysSince(new Date("2026-10-28T09:00:00Z"), now)).toBe(2);
    expect(daysSince(null, now)).toBeNull();
  });
});

describe("Registration routes", () => {
  let app;
  beforeEach(() => {
    app = buildApp();
    mockGetRegistration.mockResolvedValue(entry());
  });

  test("operator without registration:approve → 403", async () => {
    const res = await request(app).get("/api/registrations").set("Authorization", `Bearer ${OPERATOR}`);
    expect(res.status).toBe(403);
    expect(mockList).not.toHaveBeenCalled();
  });

  test("list: rows without documents + counts", async () => {
    mockList.mockResolvedValue({
      rows: [entry()],
      counts: { all: 1, pending: 1, approved: 0, rejected: 0 },
      pagination: { total: 1, page: 1, perPage: 10, pages: 1 },
    });
    const res = await request(app).get("/api/registrations?status=pending").set("Authorization", `Bearer ${KTA}`);
    expect(res.status).toBe(200);
    expect(res.body.data[0]).toMatchObject({ company_id: 500, status: "pending", waiting_days: 0 });
    expect(res.body.data[0]).not.toHaveProperty("documents");
    expect(res.body.counts.pending).toBe(1);
  });

  test("detail: own association sees documents; other association 403", async () => {
    const own = await request(app).get("/api/registrations/500").set("Authorization", `Bearer ${KTA}`);
    expect(own.status).toBe(200);
    expect(own.body.data.documents.motac_license_file).toBe("/uploads/companies/motac.pdf");

    const other = await request(app).get("/api/registrations/500").set("Authorization", `Bearer ${KOBETA}`);
    expect(other.status).toBe(403);
  });

  test("approve / reject: other association can't, superadmin can", async () => {
    const blocked = await request(app).post("/api/registrations/500/approve").set("Authorization", `Bearer ${KOBETA}`);
    expect(blocked.status).toBe(403);
    expect(mockApprove).not.toHaveBeenCalled();

    mockApprove.mockResolvedValue(entry("approved"));
    const ok = await request(app).post("/api/registrations/500/approve").set("Authorization", `Bearer ${SUPERADMIN}`);
    expect(ok.status).toBe(200);
    expect(ok.body.data.status).toBe("approved");

    mockReject.mockResolvedValue(entry("rejected"));
    const rejected = await request(app)
      .post("/api/registrations/500/reject")
      .set("Authorization", `Bearer ${KTA}`)
      .send({ reason: "No licence" });
    expect(rejected.status).toBe(200);
    expect(mockReject).toHaveBeenCalledWith("500", "No licence", expect.objectContaining({ association_id: 7 }));
    expect(rejected.body.data.rejection_reason).toBe("No licence");
  });

  test("pending count", async () => {
    mockPendingCount.mockResolvedValue(3);
    const res = await request(app).get("/api/registrations/pending-count").set("Authorization", `Bearer ${KTA}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ pending: 3 });
  });
});
