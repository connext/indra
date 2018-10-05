require("babel-register");
require("babel-polyfill");
const HDWalletProvider = require("truffle-hdwallet-provider-privkey");

var test = false;
var rinkeby = false;
var account;

if (test) {
  account = "0x01da6f5f5c89f3a83cc6bebb0eafc1f1e1c4a303";
  if (rinkeby) {
    account = "0x1e8524370b7caf8dc62e3effbca04ccc8e493ffe";
  }
}

module.exports = {
  networks: {
    coverage: {
      host: "localhost",
      network_id: "*",
      port: 9545, // <-- If you change this, also set the port option in .solcover.js.
      gas: 0xfffffffffff, // <-- Use this high gas value
      gasPrice: 0x01 // <-- Use this low gas price
    },
    rinkeby: {
      provider: () => {
        return new HDWalletProvider(
          "2940e1526f1b5ae5b5335758b82d4f2627bd522d4d186ec6ce7fe5d12b58074f",
          "https://rinkeby.infura.io/nsUEX1RYRhRDJoN89CrK"
        );
      },
      network_id: 4,
      gas: 4612388 // Gas limit used for deploys
    },
    ropsten: {
      host: "127.0.0.1",
      port: 8545,
      network_id: "3",
      from: account,
      gas: 4700000
    },
    mainnet: {
      host: "127.0.0.1",
      port: 8545,
      network_id: "1",
      gas: 4700000
    },
    ganache: {
      host: "127.0.0.1",
      port: 7545,
      network_id: "4447",
      gas: 4700000
    },
    truffledev: {
      host: "127.0.0.1",
      port: 9545,
      network_id: "4447",
      gas: 4700000
    },
    development: {
      host: "localhost",
      port: 8545,
      network_id: "*",
      gas: 4700000
    }
  },
  solc: {
    optimizer: {
      enabled: true,
      runs: 500
    }
  },
  mocha: {
    enableTimeouts: false
  }
};
