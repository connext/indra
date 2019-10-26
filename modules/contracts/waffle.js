const request = require('request');

require("dotenv").config();

var waffleConfig = {
  "npmPath": "../../node_modules",
  "legacyOutput": true,
  "compilerOptions": {
    "evmVersion": "constantinople"
  },
  "solcVersion": "v0.5.12+commit.7709ece9"
};

var selectSolc = () => {
  // TODO: which should select "native" in CI, but the solc binary in the CI
  // environment is currently too old
  if (process.env.NATIVE_SOLC == "true") {
    waffleConfig.compiler = "native";
  }

  return waffleConfig;
}

module.exports = selectSolc();
