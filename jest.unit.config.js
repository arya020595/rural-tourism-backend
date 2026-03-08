/**
 * Jest config for unit tests only.
 * Skips globalSetup/teardown (no DB needed) — suitable for CI pipelines.
 *
 * Run with: npx jest --config jest.unit.config.js
 */
module.exports = {
  testEnvironment: "node",
  coverageDirectory: "coverage",
  collectCoverageFrom: [
    "middleware/**/*.js",
    "routes/**/*.js",
    "models/**/*.js",
    "controllers/**/*.js",
    "!**/node_modules/**",
    "!**/tests/**",
    "!**/coverage/**",
  ],
  testMatch: ["**/tests/unit/**/*.test.js"],
  roots: ["<rootDir>/tests"],
  testPathIgnorePatterns: ["/node_modules/"],
  verbose: true,
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  testTimeout: 10000,
  displayName: {
    name: "RT-UNIT",
    color: "green",
  },
};
