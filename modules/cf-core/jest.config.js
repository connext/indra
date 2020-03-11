module.exports = {
  bail: true,
  cacheDirectory: "./.jest.cache",
  coverageDirectory: "jest-coverage",
  coveragePathIgnorePatterns: ["test"],
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
  globalSetup: "<rootDir>/test/global-setup.jest.ts",
  globalTeardown: "<rootDir>/test/global-teardown.jest.ts",
  moduleFileExtensions: ["ts", "js", "json"],
  rootDir: ".",
  roots: ["src", "test"],
  testEnvironment: "<rootDir>/test/node-test-environment.jest.js",
  testPathIgnorePatterns: ["node_modules", "dist"],
  testRegex: "\\.spec\\.(jsx?|tsx?)$",
  testURL: "http://localhost/",
  transform: { "^.+(?!\\.d)\\.ts$": "ts-jest" },
  transformIgnorePatterns: [".*\\.d\\.ts$", "node_modules/(?!@counterfactual)"],
  verbose: true,
};
