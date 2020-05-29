import { JsonRpcProvider } from "ethers/providers";

import { classicProviders } from "./constants";

export const getProvider = (providerUrl: string): JsonRpcProvider =>
  new JsonRpcProvider(
    providerUrl,
    classicProviders.includes(providerUrl) ? "classic" : undefined,
  );
