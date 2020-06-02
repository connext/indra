module.exports = {
  rules: {
    "@typescript-eslint/no-unused-expressions": ["off"],
    "comma-dangle": ["error", "always-multiline"],
    "max-len": ["warn", { code: 100, ignoreStrings: true, ignoreTemplateLiterals: true, ignoreComments: true }],
    "no-async-promise-executor": ["off"],
    "no-empty-pattern": ["off"],
    "no-prototype-builtins": ["off"],
    "no-undef": ["error"],
    "no-var": ["error"],
    "object-curly-spacing": ["error", "always"],
    "quotes": ["error", "double", { allowTemplateLiterals: true, avoidEscape: true }],
    "react-hooks/rules-of-hooks": ["off"],
    "react/display-name": ["off"],
    "react/no-unescaped-entities": ["off"],
    "react/prop-types": ["off"],
    "semi": ["error", "always"],
    "sort-keys": ["off"],
    "spaced-comment": ["off"],
  },
  settings: {
    react: {
      version: "detect",
    },
  },
  env: {
    browser: true,
    es6: true,
    mocha: true,
  },
  extends: [
    "react-app",
    "plugin:react/recommended",
    "plugin:@typescript-eslint/eslint-recommended",
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaFeatures: {
      jsx: true,
    },
    ecmaVersion: 2018,
    sourceType: "module",
  },
  plugins: ["react", "@typescript-eslint", "prettier"],
};
