const express = require("express");
const request = require("supertest");
const { generateToken } = require("../../../middleware/auth");

// ── Service mocks ──────────────────────────────────────────────────────────
const mockGetBookingPdfData = jest.fn();
const mockGetBookingById = jest.fn();
const mockGetBookings = jest.fn();
const mockCreateBooking = jest.fn();
const mockUpdateBooking = jest.fn();
const mockUpdateBookingStatus = jest.fn();
const mockDeleteBooking = jest.fn();

jest.mock("../../../services/bookingsService", () => ({
  getBookingPdfData: (...args) => mockGetBookingPdfData(...args),
  getBookingById: (...args) => mockGetBookingById(...args),
  getBookings: (...args) => mockGetBookings(...args),
  createBooking: (...args) => mockCreateBooking(...args),
  updateBooking: (...args) => mockUpdateBooking(...args),
  updateBookingStatus: (...args) => mockUpdateBookingStatus(...args),
  deleteBooking: (...args) => mockDeleteBooking(...args),
}));

// ── PDF generator mock ─────────────────────────────────────────────────────
const mockGenerateBookingConfirmationPdf = jest.fn();

jest.mock("../../../utils/bookingPdfGenerator", () => ({
  generateBookingConfirmationPdf: (...args) =>
    mockGenerateBookingConfirmationPdf(...args),
}));

const bookingRoutes = require("../../../routes/bookingRoutes");

// ── Helpers ────────────────────────────────────────────────────────────────
const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use("/api/bookings", bookingRoutes);
  app.use((err, req, res, _next) => {
    res.status(err.status || err.statusCode || 500).json({
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
const OPERATOR_WITH_BOOKING_READ = makeToken(["booking:read"], "operator_admin", {
  company_id: 1,
});
const OPERATOR_NO_PERMS = makeToken(["activity:read"], "operator_admin", {
  company_id: 1,
});

// Sample booking PDF data (plain object, no toJSON – policy calls toJSON if present)
const samplePdfData = {
  id: 1,
  company_id: 1,
  touristFullName: "Ahmad Bin Ali",
  companyName: "Sabah Adventure Co.",
  productName: "River Rafting",
  totalPax: 4,
  location: "Padas River, Sabah",
  activityDate: "2026-06-15",
  status: "confirmed",
  operatorName: "Operator One",
  operatorEmail: "operator@example.com",
  totalPrice: "280.00",
  createdAt: "2026-05-01T10:00:00.000Z",
};

const FAKE_PDF_BUFFER = Buffer.from("%PDF-1.4 fake pdf content");

// ═══════════════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe("GET /api/bookings/:id/pdf", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGenerateBookingConfirmationPdf.mockResolvedValue(FAKE_PDF_BUFFER);
  });

  describe("Authentication", () => {
    test("should return 401 without a token", async () => {
      const app = buildApp();
      const res = await request(app).get("/api/bookings/1/pdf");

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Access denied. No token provided.");
    });

    test("should return 401 with an invalid token", async () => {
      const app = buildApp();
      const res = await request(app)
        .get("/api/bookings/1/pdf")
        .set("Authorization", "Bearer invalid-token");

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  describe("Authorization", () => {
    test("should return 403 without booking:read permission", async () => {
      const app = buildApp();
      const res = await request(app)
        .get("/api/bookings/1/pdf")
        .set("Authorization", `Bearer ${OPERATOR_NO_PERMS}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    test("should return 403 when policy denies access (different company)", async () => {
      const app = buildApp();
      // Booking belongs to company_id 2, but the operator is in company_id 1
      mockGetBookingPdfData.mockResolvedValue({ ...samplePdfData, company_id: 2 });

      const res = await request(app)
        .get("/api/bookings/1/pdf")
        .set("Authorization", `Bearer ${OPERATOR_WITH_BOOKING_READ}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });

  describe("Not Found", () => {
    test("should return 404 when booking does not exist", async () => {
      const app = buildApp();
      const notFoundError = new Error("Booking not found.");
      notFoundError.statusCode = 404;
      mockGetBookingPdfData.mockRejectedValue(notFoundError);

      const res = await request(app)
        .get("/api/bookings/999/pdf")
        .set("Authorization", `Bearer ${SUPERADMIN_TOKEN}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Booking not found.");
    });
  });

  describe("Success", () => {
    test("should return 200 with PDF content-type and attachment header for superadmin", async () => {
      const app = buildApp();
      mockGetBookingPdfData.mockResolvedValue(samplePdfData);

      const res = await request(app)
        .get("/api/bookings/1/pdf")
        .set("Authorization", `Bearer ${SUPERADMIN_TOKEN}`);

      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toMatch(/application\/pdf/);
      expect(res.headers["content-disposition"]).toMatch(
        /attachment; filename="booking-1\.pdf"/,
      );
      expect(res.body).toBeDefined();
    });

    test("should return 200 for operator with booking:read on own company booking", async () => {
      const app = buildApp();
      mockGetBookingPdfData.mockResolvedValue(samplePdfData); // company_id: 1 matches token

      const res = await request(app)
        .get("/api/bookings/1/pdf")
        .set("Authorization", `Bearer ${OPERATOR_WITH_BOOKING_READ}`);

      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toMatch(/application\/pdf/);
    });

    test("should call getBookingPdfData with the booking id from path param", async () => {
      const app = buildApp();
      mockGetBookingPdfData.mockResolvedValue(samplePdfData);

      await request(app)
        .get("/api/bookings/42/pdf")
        .set("Authorization", `Bearer ${SUPERADMIN_TOKEN}`);

      expect(mockGetBookingPdfData).toHaveBeenCalledWith("42");
    });
  });
});
