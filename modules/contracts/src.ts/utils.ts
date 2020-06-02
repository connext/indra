import { providers } from "ethers";

import { classicProviders } from "./constants";

export const getProvider = (providerUrl: string): providers.JsonRpcProvider =>
  new providers.JsonRpcProvider(
    providerUrl,
    classicProviders.includes(providerUrl) ? "classic" : undefined,
  );
