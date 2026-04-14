const express = require("express");
const request = require("supertest");
const { generateToken } = require("../../../middleware/auth");

const mockActivityBookingFindByPk = jest.fn();
const mockAccommodationBookingFindByPk = jest.fn();
const mockDbQuery = jest.fn();

const mockMarkActivityPaid = jest.fn((req, res) =>
  res.status(200).json({ success: true, endpoint: "activity-paid" }),
);
const mockMarkAccommodationPaid = jest.fn((req, res) =>
  res.status(200).json({ success: true, endpoint: "accommodation-paid" }),
);
const mockGetAllBookingsForOperator = jest.fn((req, res) =>
  res.status(200).json({ success: true, bookings: [] }),
);

jest.mock("../../../models/bookingActivityModel", () => ({
  findByPk: (...args) => mockActivityBookingFindByPk(...args),
}));

jest.mock("../../../models/bookingAccommodationModel", () => ({
  findByPk: (...args) => mockAccommodationBookingFindByPk(...args),
}));

jest.mock("../../../config/db", () => ({
  query: (...args) => mockDbQuery(...args),
  QueryTypes: { UPDATE: "UPDATE" },
}));

jest.mock("../../../controllers/bookingActivityController.js", () => ({
  createBooking: (req, res) => res.status(201).json({ success: true }),
  getBookedDatesByOperatorActivity: (req, res) => res.status(200).json({ success: true }),
  getBookedDatesByActivity: (req, res) => res.status(200).json({ success: true }),
  getBookingsByUser: (req, res) => res.status(200).json({ success: true }),
  getBookingById: (req, res) => res.status(200).json({ success: true }),
}));

jest.mock("../../../controllers/bookingAccommodationController", () => ({
  createAccommodationBooking: (req, res) => res.status(201).json({ success: true }),
  getBookedDatesByAccommodation: (req, res) => res.status(200).json({ success: true }),
  getAccommodationBookingById: (req, res) => res.status(200).json({ success: true }),
  getAccommodationBookingsByUser: (req, res) => res.status(200).json({ success: true }),
}));

jest.mock("../../../controllers/operatorBookingsController.js", () => ({
  getAllBookingsForOperator: (...args) => mockGetAllBookingsForOperator(...args),
  markActivityPaid: (...args) => mockMarkActivityPaid(...args),
  markAccommodationPaid: (...args) => mockMarkAccommodationPaid(...args),
}));

jest.mock("../../../controllers/receiptController", () => ({
  generatePdfFromImage: (req, res) => res.status(200).json({ success: true }),
}));

const bookingActivityRoutes = require("../../../routes/bookingActivityRoutes");
const bookingAccommodationRoutes = require("../../../routes/bookingAccommodationRoutes");
const operatorBookingsRoutes = require("../../../routes/operatorBookingsRoute");
const receiptRoutes = require("../../../routes/receiptRoutes");

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use("/api/activity-booking", bookingActivityRoutes);
  app.use("/api/accommodation-booking", bookingAccommodationRoutes);
  app.use("/api/operator-bookings", operatorBookingsRoutes);
  app.use("/api/receipts", receiptRoutes);
  return app;
};

const makeToken = (permissions = [], role = "operator") =>
  generateToken({
    id: 1,
    unified_user_id: 1,
    user_type: "operator",
    username: "operator1",
    role,
    permissions,
  });

describe("financial and critical endpoint authorization", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("PATCH /api/activity-booking/mark-paid/:id", () => {
    test("should return 401 without token", async () => {
      const app = buildApp();
      const response = await request(app).patch("/api/activity-booking/mark-paid/11");

      expect(response.status).toBe(401);
    });

    test("should return 403 with insufficient permission", async () => {
      const app = buildApp();
      const token = makeToken(["booking:read"]);

      const response = await request(app)
        .patch("/api/activity-booking/mark-paid/11")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(403);
    });

    test("should return 200 with booking:update permission", async () => {
      const app = buildApp();
      const token = makeToken(["booking:update"]);
      const booking = {
        status: "Pending",
        save: jest.fn().mockResolvedValue(undefined),
      };
      mockActivityBookingFindByPk.mockResolvedValue(booking);

      const response = await request(app)
        .patch("/api/activity-booking/mark-paid/11")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.booking.status).toBe("Paid");
      expect(booking.save).toHaveBeenCalledTimes(1);
    });
  });

  describe("PATCH /api/accommodation-booking/mark-paid/:id", () => {
    test("should return 401 without token", async () => {
      const app = buildApp();
      const response = await request(app).patch("/api/accommodation-booking/mark-paid/12");

      expect(response.status).toBe(401);
    });

    test("should return 403 with insufficient permission", async () => {
      const app = buildApp();
      const token = makeToken(["booking:read"]);

      const response = await request(app)
        .patch("/api/accommodation-booking/mark-paid/12")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(403);
    });

    test("should return 200 with booking:update permission", async () => {
      const app = buildApp();
      const token = makeToken(["booking:update"]);
      const booking = {
        status: "pending",
        save: jest.fn().mockResolvedValue(undefined),
      };
      mockAccommodationBookingFindByPk.mockResolvedValue(booking);

      const response = await request(app)
        .patch("/api/accommodation-booking/mark-paid/12")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.booking.status).toBe("paid");
      expect(booking.save).toHaveBeenCalledTimes(1);
    });
  });

  describe("operator booking payment routes", () => {
    test("POST /api/operator-bookings/activity/:id/paid should enforce 401 and 403", async () => {
      const app = buildApp();

      const noToken = await request(app).post(
        "/api/operator-bookings/activity/1/paid",
      );
      expect(noToken.status).toBe(401);

      const token = makeToken(["booking:read"]);

      const forbidden = await request(app)
        .post("/api/operator-bookings/activity/1/paid")
        .set("Authorization", `Bearer ${token}`);
      expect(forbidden.status).toBe(403);
    });
  });

  describe("POST /api/receipts/void-receipt", () => {
    test("should enforce receipt:create and allow authorized request", async () => {
      const app = buildApp();

      const unauthorized = await request(app)
        .post("/api/receipts/void-receipt")
        .send({ receipt_id: 321 });
      expect(unauthorized.status).toBe(401);

      const forbiddenToken = makeToken(["booking:update"]);
      const forbidden = await request(app)
        .post("/api/receipts/void-receipt")
        .set("Authorization", `Bearer ${forbiddenToken}`)
        .send({ receipt_id: 321 });
      expect(forbidden.status).toBe(403);

      mockDbQuery.mockResolvedValue([1]);
      const allowedToken = makeToken(["receipt:create"]);
      const allowed = await request(app)
        .post("/api/receipts/void-receipt")
        .set("Authorization", `Bearer ${allowedToken}`)
        .send({ receipt_id: 321 });

      expect(allowed.status).toBe(200);
      expect(allowed.body.message).toBe("Receipt voided successfully");
      expect(mockDbQuery).toHaveBeenCalled();
    });
  });
});
