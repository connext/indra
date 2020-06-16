module.exports = {
  bail: true,
  cacheDirectory: "./.jest.cache",
  coverageDirectory: "jest-coverage",
  coverageThreshold: {
    global: {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90,
    },
  },
  extraGlobals: ["Math"],
  globals: {
    "ts-jest": {
      isolatedModules: true,
    },
  },
  globalSetup: "<rootDir>/src/testing/global-setup.jest.ts",
  globalTeardown: "<rootDir>/src/testing/global-teardown.jest.ts",
  moduleFileExtensions: ["ts", "js", "json"],
  rootDir: ".",
  roots: ["src"],
  testEnvironment: "<rootDir>/src/testing/node-test-environment.jest.js",
  testPathIgnorePatterns: ["node_modules", "dist"],
  testRegex: "\\.spec\\.(jsx?|tsx?)$",
  testURL: "http://localhost/",
  transform: { "^.+(?!\\.d)\\.ts$": "ts-jest" },
  transformIgnorePatterns: [".*\\.d\\.ts$"],
  verbose: true,
};
