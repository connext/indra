const { usePlugin } = require("@nomiclabs/buidler/config");
const waffleDefaultAccounts = require("ethereum-waffle/dist/config/defaultAccounts").default;

usePlugin("@nomiclabs/buidler-ethers");

module.exports = {
  defaultNetwork: "buidlerevm",
  solc: {
    version: "0.5.11",
  },
  paths: {
    artifacts: "./build",
  },
  networks: {
    buidlerevm: {
      accounts: waffleDefaultAccounts.map(acc => ({
        balance: acc.balance,
        privateKey: acc.secretKey,
      })),
    },
  },
};
