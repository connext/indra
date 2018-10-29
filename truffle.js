const HDWalletProvider = require("truffle-hdwallet-provider");

module.exports = {
  networks: {
    rinkeby: {
      provider: () => {
        return new HDWalletProvider(
          "candy maple cake sugar pudding cream honey rich smooth crumble",
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
      port: 8545,
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
  }
};
