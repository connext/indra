import { BuidlerConfig } from "@nomiclabs/buidler/config";
import { usePlugin } from "@nomiclabs/buidler/config";

usePlugin("@nomiclabs/buidler-ethers");
usePlugin("@nomiclabs/buidler-waffle");

const config: BuidlerConfig = {
  paths: {
    sources: "./contracts",
    artifacts: "./build",
  },
  solc: {
    version: "0.5.11", // Note that this only has the version number
    evmVersion: "constantinople",
  },
  defaultNetwork: "buidlerevm",
  networks: {
    buidlerevm: {},
  },
};

export default config;
