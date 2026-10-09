const jwt = require("jsonwebtoken");
const {
  authenticate,
  optionalAuth,
  generateToken,
} = require("../../../middleware/auth");

const createMockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe("auth middleware", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("authenticate", () => {
    test("should return 401 when token is missing", () => {
      const req = { headers: {} };
      const res = createMockRes();
      const next = jest.fn();

      authenticate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        code: "NO_TOKEN",
        message: "Access denied. No token provided.",
      });
      expect(next).not.toHaveBeenCalled();
    });

    test("should return 401 when token is expired", () => {
      const req = { headers: { authorization: "Bearer expired-token" } };
      const res = createMockRes();
      const next = jest.fn();

      jest.spyOn(jwt, "verify").mockImplementation(() => {
        const error = new Error("jwt expired");
        error.name = "TokenExpiredError";
        throw error;
      });

      authenticate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        code: "TOKEN_EXPIRED",
        message: "Token expired. Please login again.",
      });
      expect(next).not.toHaveBeenCalled();
    });

    test("should return 401 when token is invalid", () => {
      const req = { headers: { authorization: "Bearer invalid-token" } };
      const res = createMockRes();
      const next = jest.fn();

      jest.spyOn(jwt, "verify").mockImplementation(() => {
        throw new Error("invalid signature");
      });

      authenticate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        code: "INVALID_TOKEN",
        message: "Invalid token.",
      });
      expect(next).not.toHaveBeenCalled();
    });

    test("should attach normalized user payload and call next for valid token", () => {
      const token = generateToken({
        id: 42,
        unified_user_id: 42,
        user_type: "operator",
        username: "operator1",
        role: "operator_admin",
        permissions: ["activity:read"],
      });

      const req = { headers: { authorization: `Bearer ${token}` } };
      const res = createMockRes();
      const next = jest.fn();

      authenticate(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(req.user).toMatchObject({
        id: 42,
        unified_user_id: 42,
        user_type: "operator",
        username: "operator1",
        role: "operator_admin",
        permissions: ["activity:read"],
      });
      expect(req.user.legacy_user_id).toBeUndefined();
    });
  });

  describe("authenticate – database re-check for tokens with src", () => {
    const { sessionService } = require("../../../services/sessionService");
    const { SessionInvalidError } = require("../../../services/errors/AppError");

    const srcToken = () =>
      generateToken({
        id: 42,
        unified_user_id: 42,
        user_type: "operator",
        username: "operator1",
        role: "operator_staff",
        permissions: ["booking:read"],
        company_id: 110,
        src: "users",
        tv: 0,
      });

    test("replaces role, permissions and company with the current database values", async () => {
      jest.spyOn(sessionService, "loadCurrentState").mockResolvedValue({
        role: "operator_admin",
        permissions: ["booking:read", "user:update"],
        company_id: 128,
        association_id: 7,
      });

      const req = { headers: { authorization: `Bearer ${srcToken()}` } };
      const res = createMockRes();
      const next = jest.fn();

      await authenticate(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith();
      expect(req.user).toMatchObject({
        id: 42,
        role: "operator_admin",
        permissions: ["booking:read", "user:update"],
        company_id: 128,
        association_id: 7,
      });
    });

    test.each([
      ["ACCOUNT_DEACTIVATED", "Your account has been deactivated. Please contact your association or admin."],
      ["SESSION_REVOKED", "Your password was changed. Please login again."],
      ["ACCOUNT_NOT_FOUND", "This account no longer exists. Please contact your association or admin."],
    ])("returns 401 %s when the session must end", async (code, message) => {
      jest
        .spyOn(sessionService, "loadCurrentState")
        .mockRejectedValue(new SessionInvalidError(message, code));

      const req = { headers: { authorization: `Bearer ${srcToken()}` } };
      const res = createMockRes();
      const next = jest.fn();

      await authenticate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ success: false, code, message });
      expect(next).not.toHaveBeenCalled();
    });

    test("passes unexpected errors (e.g. database down) to the error handler", async () => {
      const dbError = new Error("connect ECONNREFUSED");
      jest.spyOn(sessionService, "loadCurrentState").mockRejectedValue(dbError);

      const req = { headers: { authorization: `Bearer ${srcToken()}` } };
      const res = createMockRes();
      const next = jest.fn();

      await authenticate(req, res, next);

      expect(next).toHaveBeenCalledWith(dbError);
      expect(res.status).not.toHaveBeenCalled();
    });

    test("does not touch the database for tokens issued before src existed", async () => {
      const spy = jest.spyOn(sessionService, "loadCurrentState");
      const token = generateToken({ id: 42, user_type: "operator", role: "operator_admin" });

      const req = { headers: { authorization: `Bearer ${token}` } };
      const res = createMockRes();
      const next = jest.fn();

      await authenticate(req, res, next);

      expect(spy).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledTimes(1);
    });
  });

  describe("optionalAuth", () => {
    test("should continue without token", () => {
      const req = { headers: {} };
      const res = createMockRes();
      const next = jest.fn();

      optionalAuth(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(req.user).toBeUndefined();
      expect(res.status).not.toHaveBeenCalled();
    });

    test("should continue on invalid token and keep request unauthenticated", () => {
      const req = { headers: { authorization: "Bearer invalid-token" } };
      const res = createMockRes();
      const next = jest.fn();

      jest.spyOn(jwt, "verify").mockImplementation(() => {
        throw new Error("invalid token");
      });

      optionalAuth(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(req.user).toBeUndefined();
      expect(res.status).not.toHaveBeenCalled();
    });

    test("should attach normalized payload when valid token is provided", () => {
      const token = generateToken({
        id: 11,
        user_type: "tourist",
        role: "tourist",
      });

      const req = { headers: { authorization: `Bearer ${token}` } };
      const res = createMockRes();
      const next = jest.fn();

      optionalAuth(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(req.user).toMatchObject({
        id: 11,
        legacy_user_id: 11,
        user_type: "tourist",
        role: "tourist",
        permissions: [],
      });
    });
  });
});
