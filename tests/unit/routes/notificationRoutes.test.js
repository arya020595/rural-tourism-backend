const express = require("express");
const request = require("supertest");
const { generateToken } = require("../../../middleware/auth");

const mockFindAll = jest.fn();
const mockCount = jest.fn();
const mockUpdate = jest.fn();
const mockFindByPk = jest.fn();

jest.mock("../../../models/notificationModel", () => ({
  findAll: (...args) => mockFindAll(...args),
  count: (...args) => mockCount(...args),
  update: (...args) => mockUpdate(...args),
  findByPk: (...args) => mockFindByPk(...args),
}));

const notificationRoutes = require("../../../routes/notificationRoutes");

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use("/api/notifications", notificationRoutes);
  return app;
};

// The association role on staging/production has registration:approve but
// not booking:read; operators have booking:read.
const ASSOCIATION = generateToken({
  id: 117, unified_user_id: 117, user_type: "association", role: "association",
  permissions: ["registration:approve", "association:read"], association_id: 7,
});
const OPERATOR = generateToken({
  id: 42, unified_user_id: 42, user_type: "operator", role: "operator_admin",
  permissions: ["booking:read"], company_id: 9,
});
const NO_PERMISSION = generateToken({
  id: 55, unified_user_id: 55, user_type: "association", role: "association",
  permissions: ["bi_dashboard:read"],
});

const auth = (token) => ({ Authorization: `Bearer ${token}` });

describe("Notification routes (the bell)", () => {
  let app;
  beforeEach(() => {
    app = buildApp();
    jest.clearAllMocks();
    mockFindAll.mockResolvedValue([{ id: 1, type: "registration_pending", user_id: 117 }]);
    mockCount.mockResolvedValue(1);
    mockUpdate.mockResolvedValue([1]);
  });

  test("an association approver without booking:read can read their own notifications", async () => {
    const res = await request(app).get("/api/notifications/operator/117").set(auth(ASSOCIATION));
    expect(res.status).toBe(200);
    expect(res.body[0].type).toBe("registration_pending");
    expect(mockFindAll.mock.calls[0][0].where).toEqual({ user_id: "117" });
  });

  test("an association approver can get their unread count and mark all read", async () => {
    const count = await request(app).get("/api/notifications/operator/117/unread-count").set(auth(ASSOCIATION));
    expect(count.status).toBe(200);
    expect(count.body.unread_count).toBe(1);

    const readAll = await request(app).patch("/api/notifications/operator/117/read-all").set(auth(ASSOCIATION));
    expect(readAll.status).toBe(200);
  });

  test("an association approver can mark their own notification read, not someone else's", async () => {
    const own = { user_id: 117, is_read: 0, update: jest.fn().mockResolvedValue() };
    mockFindByPk.mockResolvedValueOnce(own);
    const ok = await request(app).patch("/api/notifications/5/read").set(auth(ASSOCIATION));
    expect(ok.status).toBe(200);
    expect(own.update).toHaveBeenCalledWith({ is_read: 1 });

    mockFindByPk.mockResolvedValueOnce({ user_id: 999, is_read: 0, update: jest.fn() });
    const other = await request(app).patch("/api/notifications/6/read").set(auth(ASSOCIATION));
    expect(other.status).toBe(403);
  });

  test("still only your own notifications", async () => {
    const res = await request(app).get("/api/notifications/operator/999").set(auth(ASSOCIATION));
    expect(res.status).toBe(403);
    expect(mockFindAll).not.toHaveBeenCalled();
  });

  test("operators with booking:read keep working", async () => {
    const res = await request(app).get("/api/notifications/operator/42").set(auth(OPERATOR));
    expect(res.status).toBe(200);
  });

  test("a user with neither permission is refused", async () => {
    const res = await request(app).get("/api/notifications/operator/55").set(auth(NO_PERMISSION));
    expect(res.status).toBe(403);
    expect(mockFindAll).not.toHaveBeenCalled();
  });
});
