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
        role: "operator",
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
        role: "operator",
        permissions: ["activity:read"],
      });
      expect(req.user.legacy_user_id).toBeUndefined();
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
