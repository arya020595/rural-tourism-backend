module.exports = {
  testEnvironment: "node",
  // Run test files sequentially - integration tests share a real database
  maxWorkers: 1,
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
  testMatch: ["**/tests/**/*.test.js"],
  roots: ["<rootDir>/tests"],
  testPathIgnorePatterns: ["/node_modules/"],
  verbose: true,
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  testTimeout: 10000,
  globalSetup: "<rootDir>/tests/setup.js",
  globalTeardown: "<rootDir>/tests/teardown.js",
  // Display test names in tree structure by module
  displayName: {
    name: "RT-BACKEND",
    color: "cyan",
  },
};
