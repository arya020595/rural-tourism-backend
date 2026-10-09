jest.mock("../../../models/unifiedUserModel");
jest.mock("../../../models/associations", () => {});
jest.mock("../../../models/touristModel");
jest.mock("../../../models/associationUserModel");

const UnifiedUser = require("../../../models/unifiedUserModel");
const TouristUser = require("../../../models/touristModel");
const { SessionService } = require("../../../services/sessionService");
const authService = require("../../../services/authService");

const makeService = () => {
  const service = new SessionService();
  jest
    .spyOn(service, "resolveRolePermissions")
    .mockResolvedValue({ role: "operator_admin", permissions: ["booking:read"] });
  return service;
};

const usersClaims = (overrides = {}) => ({
  id: 42,
  unified_user_id: 42,
  user_type: "operator",
  role: "operator_staff",
  src: "users",
  tv: 0,
  ...overrides,
});

describe("SessionService.loadCurrentState", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("returns null for tokens without src (legacy behaviour)", async () => {
    const service = makeService();
    await expect(service.loadCurrentState({ id: 42 })).resolves.toBeNull();
    expect(UnifiedUser.findByPk).not.toHaveBeenCalled();
  });

  test("returns the current role, permissions and company for an active user", async () => {
    UnifiedUser.findByPk = jest.fn().mockResolvedValue({
      id: 42,
      is_active: true,
      role_id: 3,
      company_id: 128,
      association_id: 7,
      token_version: 0,
    });
    const service = makeService();

    await expect(service.loadCurrentState(usersClaims())).resolves.toEqual({
      role: "operator_admin",
      permissions: ["booking:read"],
      company_id: 128,
      association_id: 7,
    });
    expect(service.resolveRolePermissions).toHaveBeenCalledWith(3, "operator");
  });

  test("rejects a deactivated user with ACCOUNT_DEACTIVATED", async () => {
    UnifiedUser.findByPk = jest.fn().mockResolvedValue({
      id: 42,
      is_active: false,
      token_version: 0,
    });

    await expect(
      makeService().loadCurrentState(usersClaims()),
    ).rejects.toMatchObject({ statusCode: 401, code: "ACCOUNT_DEACTIVATED" });
  });

  test("rejects a removed user with ACCOUNT_NOT_FOUND", async () => {
    UnifiedUser.findByPk = jest.fn().mockResolvedValue(null);

    await expect(
      makeService().loadCurrentState(usersClaims()),
    ).rejects.toMatchObject({ statusCode: 401, code: "ACCOUNT_NOT_FOUND" });
  });

  test("rejects a token from before a password change with SESSION_REVOKED", async () => {
    UnifiedUser.findByPk = jest.fn().mockResolvedValue({
      id: 42,
      is_active: true,
      role_id: 3,
      token_version: 2,
    });

    await expect(
      makeService().loadCurrentState(usersClaims({ tv: 1 })),
    ).rejects.toMatchObject({ statusCode: 401, code: "SESSION_REVOKED" });
  });

  test("rejects a deactivated tourist account", async () => {
    TouristUser.findByPk = jest.fn().mockResolvedValue({
      tourist_user_id: 10,
      is_active: false,
      role_id: 2,
    });

    await expect(
      makeService().loadCurrentState({ id: 10, user_type: "tourist", src: "tourist_users" }),
    ).rejects.toMatchObject({ code: "ACCOUNT_DEACTIVATED" });
  });
});

describe("SessionService.resolveRolePermissions caching", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("looks a role up once and serves repeats from the cache", async () => {
    const resolveRole = jest
      .spyOn(authService, "resolveRole")
      .mockResolvedValue({ name: "operator_admin", permissions: [{ code: "booking:read" }] });
    const service = new SessionService();

    const first = await service.resolveRolePermissions(3, "operator");
    const second = await service.resolveRolePermissions(3, "operator");

    expect(first).toEqual({ role: "operator_admin", permissions: ["booking:read"] });
    expect(second).toEqual(first);
    expect(resolveRole).toHaveBeenCalledTimes(1);
  });
});
