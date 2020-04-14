import { ConnextStore } from "@connext/store";
import { ClientOptions, StoreTypes } from "@connext/types";

export const getDefaultStore = (opts: Partial<ClientOptions>) => {
  const storeType = (opts && opts.storeType) ? opts.storeType : StoreTypes.LocalStorage;
  const backupService = (opts && opts.backupService) ? opts.backupService : null;
  return new ConnextStore(storeType, { backupService });
};

export const getDefaultOptions = async (
  network: string,
  opts?: Partial<ClientOptions>,
): Promise<ClientOptions> => {
  let urlOptions = { ethProviderUrl: `http://localhost:8545`, nodeUrl: `http://localhost:8080` };

  if (!opts) {
    return ({
      store: new ConnextStore(StoreTypes.LocalStorage),
      ...urlOptions,
    });
  }

  if (network.toLowerCase() !== "localhost") {
    const baseUrl = network.toLowerCase() === "mainnet"
      ? "indra.connext.network/api"
      : network.toLowerCase() === "rinkeby"
      ? "rinkeby.indra.connext.network/api"
      : null;
    if (!baseUrl) {
      throw new Error(`Provided network (${network.toLowerCase()}) is not supported`);
    }
    urlOptions = {
      ethProviderUrl: `https://${baseUrl}/ethprovider`,
      nodeUrl: `https://${baseUrl}`,
    };
  }

  return ({
    store: opts.store || getDefaultStore(opts),
    ...urlOptions,
  });
};
