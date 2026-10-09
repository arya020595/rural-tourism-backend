const jwt = require("jsonwebtoken");

jest.mock("../../../models/unifiedUserModel");
jest.mock("../../../models/associations", () => {});
jest.mock("bcrypt");

const bcrypt = require("bcrypt");
const UnifiedUser = require("../../../models/unifiedUserModel");
const authService = require("../../../services/authService");
const { JWT_SECRET } = require("../../../middleware/auth");

const DAY_MS = 24 * 60 * 60 * 1000;
const nowSeconds = () => Math.floor(Date.now() / 1000);

const operatorClaims = (overrides = {}) => ({
  sub: "operator:42",
  id: 42,
  unified_user_id: 42,
  user_type: "operator",
  username: "operator1",
  role: "operator_admin",
  permissions: ["booking:read"],
  company_id: 128,
  src: "users",
  tv: 3,
  ...overrides,
});

describe("AuthService.renewTokenIfNeeded", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("keeps the current token while it has more than 7 days left", async () => {
    const claims = operatorClaims({ exp: nowSeconds() + 20 * 24 * 60 * 60 });
    await expect(authService.renewTokenIfNeeded(claims)).resolves.toBeNull();
  });

  test("issues a fresh token with the same claims when under 7 days are left", async () => {
    const claims = operatorClaims({ exp: nowSeconds() + 2 * 24 * 60 * 60 });

    const token = await authService.renewTokenIfNeeded(claims);
    const decoded = jwt.verify(token, JWT_SECRET);

    expect(decoded).toMatchObject({
      id: 42,
      unified_user_id: 42,
      user_type: "operator",
      role: "operator_admin",
      permissions: ["booking:read"],
      company_id: 128,
      src: "users",
      tv: 3,
    });
    expect(decoded.exp * 1000 - Date.now()).toBeGreaterThan(25 * DAY_MS);
  });

  test("upgrades an active operator's pre-src token", async () => {
    UnifiedUser.findByPk = jest.fn().mockResolvedValue({
      id: 42,
      is_active: true,
      token_version: 5,
    });
    const claims = operatorClaims({ src: undefined, tv: undefined, exp: nowSeconds() + 3600 });

    const decoded = jwt.verify(await authService.renewTokenIfNeeded(claims), JWT_SECRET);

    expect(decoded).toMatchObject({ id: 42, src: "users", tv: 5 });
  });

  test("does not upgrade a deactivated operator's pre-src token", async () => {
    UnifiedUser.findByPk = jest.fn().mockResolvedValue({ id: 42, is_active: false });
    const claims = operatorClaims({ src: undefined, tv: undefined, exp: nowSeconds() + 3600 });

    await expect(authService.renewTokenIfNeeded(claims)).resolves.toBeNull();
  });

  test("leaves pre-src tourist tokens to expire", async () => {
    const claims = { id: 10, user_type: "tourist", role: "tourist", exp: nowSeconds() + 3600 };
    await expect(authService.renewTokenIfNeeded(claims)).resolves.toBeNull();
  });
});

describe("AuthService.changePassword", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("bumps token_version and returns a token carrying the new version", async () => {
    const dbUser = {
      id: 42,
      password: "old-hash",
      token_version: 3,
      save: jest.fn().mockResolvedValue(undefined),
    };
    UnifiedUser.findByPk = jest.fn().mockResolvedValue(dbUser);
    bcrypt.compare.mockResolvedValue(true);
    bcrypt.hash.mockResolvedValue("new-hash");

    const result = await authService.changePassword({
      user: operatorClaims(),
      currentPassword: "old-password",
      newPassword: "new-password-123",
    });

    expect(dbUser.token_version).toBe(4);
    expect(dbUser.save).toHaveBeenCalled();
    expect(jwt.verify(result.token, JWT_SECRET)).toMatchObject({ id: 42, src: "users", tv: 4 });
  });
});
