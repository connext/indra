import { ConnextStore } from "@connext/store";
import { ClientOptions, StoreTypes } from "@connext/types";
import { removeUndefinedFields } from "@connext/utils";

export const MAINNET_NETWORK = "mainnet";
export const RINKEBY_NETWORK = "rinkeby";
export const LOCALHOST_NETWORK = "localhost";

export function isMainnet(network: string): boolean {
  return network.toLowerCase() === MAINNET_NETWORK.toLowerCase();
}

export function isRinkeby(network: string): boolean {
  return network.toLowerCase() === RINKEBY_NETWORK.toLowerCase();
}

export function isLocalhost(network: string): boolean {
  return network.toLowerCase() === LOCALHOST_NETWORK.toLowerCase();
}

export function getOptionIfAvailable(option: string, opts?: Partial<ClientOptions>) {
  return opts && opts[option] ? opts[option] : undefined;
}

export function getDefaultStore(opts?: Partial<ClientOptions>): ConnextStore {
  const storeType = getOptionIfAvailable("storeType", opts);
  const backupService = getOptionIfAvailable("backupService", opts);
  return new ConnextStore(storeType || StoreTypes.LocalStorage, { backupService });
}

export function getDefaultUrlOptions(network: string) {
  let urlOptions = {
    ethProviderUrl: `http://localhost:8545`,
    nodeUrl: `http://localhost:8080`,
  };
  if (!isLocalhost(network)) {
    const baseUrl = isMainnet(network)
      ? "indra.connext.network/api"
      : isRinkeby(network)
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

  return urlOptions;
}

export async function getDefaultOptions(
  network: string,
  overrideOptions?: Partial<ClientOptions>,
): Promise<ClientOptions> {
  const urlOptions = getDefaultUrlOptions(network);

  const store = getOptionIfAvailable("store", overrideOptions) || getDefaultStore(overrideOptions);

  const opts = {
    store,
    ...urlOptions,
    ...removeUndefinedFields<Partial<ClientOptions>>(overrideOptions),
  };

  return opts;
}
