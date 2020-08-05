import { providers } from "ethers";

const classicProviders = ["https://www.ethercluster.com/etc"];
const classicChainIds = [61];

export const getEthProvider = (providerUrl: string, chainId?: number): providers.JsonRpcProvider =>
  new providers.JsonRpcProvider(
    providerUrl,
    (classicProviders.includes(providerUrl) || classicChainIds.includes(chainId))
      ? "classic"
      : undefined,
  );
