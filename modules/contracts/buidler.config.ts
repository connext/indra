import { BuidlerConfig } from "@nomiclabs/buidler/config";
import { usePlugin } from "@nomiclabs/buidler/config";
import waffleDefaultAccounts from "ethereum-waffle/dist/config/defaultAccounts";

usePlugin("@nomiclabs/buidler-ethers");

const config: BuidlerConfig = {
  paths: {
    sources: "./contracts",
    artifacts: "./build",
  },
  solc: {
    version: "0.5.11", // Note that this only has the version number
    evmVersion: "constantinople",
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

export default config;
