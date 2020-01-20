module.exports = {
    rules: {
      "comma-dangle": ["error", "only-multiline"],
      "indent": ["error", 2],
      "max-len": ["error", 100],
      "no-undef": ["error"],
      "no-unused-vars": ["error"],
      "no-var": ["error"],
      "object-curly-spacing": ["error", "always"],
      "quotes": ["error", "double"],
      "semi": ["error", "always"],
      "spaced-comment": "off",
    },
    settings: {
      react: {
        version: "detect",
      },
    },
    env: {
      browser: true,
      es6: true
    },
    extends: [
      "react-app",
      "eslint:recommended",
      "plugin:react/recommended",
      "plugin:@typescript-eslint/eslint-recommended",
    ],
    parser: "@typescript-eslint/parser",
    parserOptions: {
      ecmaFeatures: {
        "jsx": true
      },
      ecmaVersion: 2018,
      sourceType: "module"
    },
    plugins: [
      "react",
      "@typescript-eslint"
    ],
};
