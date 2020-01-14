const HDWalletProvider = require("truffle-hdwallet-provider");

require("ts-node/register");
require("dotenv").config();

module.exports = {
  compilers: {
    solc: {
      version: "native"
    }
  },
  solc: {
    optimizer: {
      enabled: true,
      runs: 200
    }
  },
  mocha: {
    useColors: true,
    reporter: "eth-gas-reporter",
    reporterOptions: {
      currency: "USD",
      gasPrice: 21,
      outputFile: "/dev/null",
      showTimeSpent: true
    }
  }
};
