const express = require("express");
const request = require("supertest");

// --- service mock factories -------------------------------------------------
const mockRequestPasswordReset = jest.fn();
const mockResetPassword = jest.fn();

jest.mock("../../../services/passwordResetService", () => ({
  passwordResetService: {
    requestPasswordReset: (...args) => mockRequestPasswordReset(...args),
    resetPassword: (...args) => mockResetPassword(...args),
  },
}));

const passwordResetRoutes = require("../../../routes/passwordResetRoutes");

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use("/api/password", passwordResetRoutes);
  return app;
};

// ---------------------------------------------------------------------------

describe("Password Reset Routes", () => {
  let app;

  beforeEach(() => {
    app = buildApp();
    jest.clearAllMocks();
  });

  // ─── POST /api/password/forgot-password ──────────────────────────────────

  describe("POST /api/password/forgot-password", () => {
    test("returns 200 with the standard message for a valid email", async () => {
      mockRequestPasswordReset.mockResolvedValue(undefined);

      const res = await request(app)
        .post("/api/password/forgot-password")
        .send({ email: "user@example.com" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toMatch(/reset link/i);
      expect(mockRequestPasswordReset).toHaveBeenCalledWith("user@example.com");
    });

    test("returns 400 when email is missing", async () => {
      const res = await request(app)
        .post("/api/password/forgot-password")
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(mockRequestPasswordReset).not.toHaveBeenCalled();
    });

    test("returns 400 when email format is invalid", async () => {
      const res = await request(app)
        .post("/api/password/forgot-password")
        .send({ email: "not-an-email" });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(mockRequestPasswordReset).not.toHaveBeenCalled();
    });

    test("returns 200 even when the service throws (no email enumeration)", async () => {
      // Non-existent email: service returns silently (undefined)
      mockRequestPasswordReset.mockResolvedValue(undefined);

      const res = await request(app)
        .post("/api/password/forgot-password")
        .send({ email: "nobody@example.com" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    test("returns 500 when an unexpected service error occurs", async () => {
      mockRequestPasswordReset.mockRejectedValue(new Error("SMTP outage"));

      const res = await request(app)
        .post("/api/password/forgot-password")
        .send({ email: "user@example.com" });

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  // ─── POST /api/password/reset-password ───────────────────────────────────

  describe("POST /api/password/reset-password", () => {
    const validToken = "a".repeat(64); // 64-char hex token
    const strongPassword = "Str0ngP@ss";

    test("returns 200 on successful password reset", async () => {
      mockResetPassword.mockResolvedValue(undefined);

      const res = await request(app)
        .post("/api/password/reset-password")
        .send({ token: validToken, password: strongPassword });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toMatch(/reset successfully/i);
      expect(mockResetPassword).toHaveBeenCalledWith(validToken, strongPassword);
    });

    test("returns 400 when token is missing", async () => {
      const res = await request(app)
        .post("/api/password/reset-password")
        .send({ password: strongPassword });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(mockResetPassword).not.toHaveBeenCalled();
    });

    test("returns 400 when token is too short", async () => {
      const res = await request(app)
        .post("/api/password/reset-password")
        .send({ token: "short", password: strongPassword });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(mockResetPassword).not.toHaveBeenCalled();
    });

    test("returns 400 when password is missing", async () => {
      const res = await request(app)
        .post("/api/password/reset-password")
        .send({ token: validToken });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(mockResetPassword).not.toHaveBeenCalled();
    });

    test("returns 400 when password is too short (< 6 chars)", async () => {
      const res = await request(app)
        .post("/api/password/reset-password")
        .send({ token: validToken, password: "abc" });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(mockResetPassword).not.toHaveBeenCalled();
    });

    test("returns 400 when the token is invalid or expired", async () => {
      const { ValidationError } = require("../../../services/errors/AppError");
      mockResetPassword.mockRejectedValue(
        new ValidationError("Invalid or expired reset token."),
      );

      const res = await request(app)
        .post("/api/password/reset-password")
        .send({ token: validToken, password: strongPassword });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    test("returns 400 when the token is expired (TokenExpiredError)", async () => {
      const { TokenExpiredError } = require("../../../services/errors/AppError");
      mockResetPassword.mockRejectedValue(new TokenExpiredError());

      const res = await request(app)
        .post("/api/password/reset-password")
        .send({ token: validToken, password: strongPassword });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    test("returns 500 when an unexpected error occurs", async () => {
      mockResetPassword.mockRejectedValue(new Error("Database failure"));

      const res = await request(app)
        .post("/api/password/reset-password")
        .send({ token: validToken, password: strongPassword });

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });
});
