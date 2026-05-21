const bcrypt = require("bcrypt");

// ── Model mocks ───────────────────────────────────────────────────────────────
jest.mock("../../../models/unifiedUserModel");
jest.mock("../../../models/touristModel");
jest.mock("../../../models/associationUserModel");
jest.mock("../../../models/roleModel");
jest.mock("../../../models/permissionModel");
jest.mock("../../../models/associations", () => {});
jest.mock("bcrypt");
// generateToken produces a real JWT – stub it to return a predictable string
jest.mock("../../../middleware/auth", () => ({
  generateToken: () => "mock-token",
}));

// Service is a singleton – import after mocks are declared
const authService = require("../../../services/authService");
const UnifiedUser = require("../../../models/unifiedUserModel");
const TouristUser = require("../../../models/touristModel");

// Minimal role stub returned by resolveRole spy
const MOCK_ROLE = {
  name: "operator_admin",
  permissions: [],
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const makeUnifiedUser = (overrides = {}) => ({
  id: 1,
  unified_user_id: 1,
  username: "Alice",
  email: "alice@example.com",
  password: "hashed",
  role_id: 1,
  company_id: null,
  association_id: null,
  user_type: "operator",
  ...overrides,
});

const makeTouristUser = (overrides = {}) => ({
  tourist_user_id: 10,
  username: "TouristBob",
  email: "bob@example.com",
  password: "hashed",
  role_id: 2,
  full_name: "Bob",
  is_active: true,
  ...overrides,
});

describe("AuthService.login – case-sensitive username", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Stub resolveRole so DB queries for Role/Permission are not needed
    jest.spyOn(authService, "resolveRole").mockResolvedValue(MOCK_ROLE);
  });

  // ── Unified Users (operators) ───────────────────────────────────────────────
  describe("UnifiedUser (operator) path", () => {
    test("succeeds with exact-case username", async () => {
      UnifiedUser.findOne.mockResolvedValue(makeUnifiedUser());
      bcrypt.compare.mockResolvedValue(true);

      await expect(
        authService.loginFromUnifiedUsers({
          identifier: "Alice",
          password: "secret",
          allowedSet: null,
        }),
      ).resolves.not.toBeNull();
    });

    test("returns null when username case does not match", async () => {
      UnifiedUser.findOne.mockResolvedValue(makeUnifiedUser());
      bcrypt.compare.mockResolvedValue(true);

      const result = await authService.loginFromUnifiedUsers({
        identifier: "alice", // lowercase – stored as "Alice"
        password: "secret",
        allowedSet: null,
      });

      expect(result).toBeNull();
      expect(bcrypt.compare).not.toHaveBeenCalled();
    });

    test("returns null for ALL_CAPS username mismatch", async () => {
      UnifiedUser.findOne.mockResolvedValue(makeUnifiedUser());
      bcrypt.compare.mockResolvedValue(true);

      const result = await authService.loginFromUnifiedUsers({
        identifier: "ALICE",
        password: "secret",
        allowedSet: null,
      });

      expect(result).toBeNull();
      expect(bcrypt.compare).not.toHaveBeenCalled();
    });

    test("succeeds when identifier is the email (case-insensitive)", async () => {
      UnifiedUser.findOne.mockResolvedValue(makeUnifiedUser());
      bcrypt.compare.mockResolvedValue(true);

      await expect(
        authService.loginFromUnifiedUsers({
          identifier: "Alice@Example.COM", // different case from stored "alice@example.com"
          password: "secret",
          allowedSet: null,
        }),
      ).resolves.not.toBeNull();
    });
  });

  // ── Tourist path ────────────────────────────────────────────────────────────
  describe("Tourist path (via login())", () => {
    beforeEach(() => {
      // Unified path returns nothing so the tourist resolver runs
      UnifiedUser.findOne.mockResolvedValue(null);
    });

    test("rejects login with wrong-case username via full login()", async () => {
      TouristUser.findOne.mockResolvedValue(
        makeTouristUser({ username: "TouristBob" }),
      );
      bcrypt.compare.mockResolvedValue(true);

      await expect(
        authService.login({
          identifier: "touristbob", // lowercase – stored as "TouristBob"
          password: "secret",
          allowedUserTypes: ["tourist"],
        }),
      ).rejects.toMatchObject({ statusCode: 401 });

      expect(bcrypt.compare).not.toHaveBeenCalled();
    });

    test("succeeds with exact-case username via full login()", async () => {
      TouristUser.findOne.mockResolvedValue(
        makeTouristUser({ username: "TouristBob" }),
      );
      bcrypt.compare.mockResolvedValue(true);

      await expect(
        authService.login({
          identifier: "TouristBob",
          password: "secret",
          allowedUserTypes: ["tourist"],
        }),
      ).resolves.toMatchObject({
        user: expect.objectContaining({ username: "TouristBob" }),
      });
    });

    test("succeeds with email regardless of case via full login()", async () => {
      TouristUser.findOne.mockResolvedValue(
        makeTouristUser({ username: "TouristBob", email: "bob@example.com" }),
      );
      bcrypt.compare.mockResolvedValue(true);

      await expect(
        authService.login({
          identifier: "BOB@EXAMPLE.COM",
          password: "secret",
          allowedUserTypes: ["tourist"],
        }),
      ).resolves.toMatchObject({
        user: expect.objectContaining({ username: "TouristBob" }),
      });
    });
  });
});
