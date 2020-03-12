module.exports = {
  preset: "ts-jest",
  globals: {
    "ts-jest": {
      tsConfig: "<rootDir>/jestSetup/tsconfig.jest.json",
      diagnostics: true,
    },
  },
  testEnvironment: "node", // alternative "node"
  setupFiles: ["<rootDir>/jestSetup/polyfill.ts"],
  modulePathIgnorePatterns: ["<rootDir>/dist/"],
};
