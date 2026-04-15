const {
  authorize,
  authorizeOwnership,
} = require("../../../middleware/authorize");

const createMockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe("authorize middleware", () => {
  describe("authorize", () => {
    test("should return 401 when user is not authenticated", () => {
      const req = { user: null };
      const res = createMockRes();
      const next = jest.fn();

      authorize("user:read")(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Unauthorized. Please login first.",
      });
      expect(next).not.toHaveBeenCalled();
    });

    test("should allow admin role", () => {
      const req = { user: { role: "admin", permissions: [] } };
      const res = createMockRes();
      const next = jest.fn();

      authorize("user:delete")(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });

    test("should allow wildcard permission", () => {
      const req = { user: { role: "operator", permissions: ["*:*"] } };
      const res = createMockRes();
      const next = jest.fn();

      authorize("booking:update")(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });

    test("should allow when required permission is present", () => {
      const req = {
        user: {
          role: "operator",
          permissions: ["activity:read", "booking:update"],
        },
      };
      const res = createMockRes();
      const next = jest.fn();

      authorize("booking:update")(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });

    test("should return 403 with required permission context", () => {
      const req = {
        user: {
          role: "tourist",
          permissions: ["activity:read"],
        },
      };
      const res = createMockRes();
      const next = jest.fn();

      authorize("booking:update")(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message:
          "Forbidden. You do not have permission to perform this action.",
        data: {
          required: ["booking:update"],
          your_role: "tourist",
        },
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe("authorizeOwnership", () => {
    test("should return 401 when user is not authenticated", () => {
      const req = { user: null, params: { user_id: "1" } };
      const res = createMockRes();
      const next = jest.fn();

      authorizeOwnership("user_id")(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Unauthorized. Please login first.",
      });
      expect(next).not.toHaveBeenCalled();
    });

    test("should allow admin bypass", () => {
      const req = {
        user: { role: "admin", legacy_user_id: 2, permissions: [] },
        params: { user_id: "99" },
      };
      const res = createMockRes();
      const next = jest.fn();

      authorizeOwnership("user_id")(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });

    test("should allow bypass permission", () => {
      const req = {
        user: {
          role: "operator",
          user_type: "operator",
          unified_user_id: 2,
          permissions: ["user:read"],
        },
        params: { user_id: "99" },
      };
      const res = createMockRes();
      const next = jest.fn();

      authorizeOwnership("user_id", ["user:read"])(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });

    test("should allow owner access", () => {
      const req = {
        user: {
          role: "operator",
          user_type: "operator",
          unified_user_id: 10,
          permissions: [],
        },
        params: { user_id: "10" },
      };
      const res = createMockRes();
      const next = jest.fn();

      authorizeOwnership("user_id")(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });

    test("should return 403 for non-owner without bypass", () => {
      const req = {
        user: {
          role: "operator",
          user_type: "operator",
          unified_user_id: 10,
          permissions: [],
        },
        params: { user_id: "22" },
      };
      const res = createMockRes();
      const next = jest.fn();

      authorizeOwnership("user_id")(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Forbidden. You can only access your own resources.",
      });
      expect(next).not.toHaveBeenCalled();
    });
  });
});
