import { ConnextStore } from "@connext/store";
import { Wallet } from "ethers";

import { ClientOptions } from "../types";

// constants

export const MNEMONIC_KEY = "CONNEXT_MNEMONIC";
export const MAINNET_NETWORK = "mainnet";
export const RINKEBY_NETWORK = "rinkeby";

// helpers

export const isNode =
  typeof process !== "undefined" &&
  typeof process.versions !== "undefined" &&
  typeof process.versions.node !== "undefined";

export function isMainnet(network: string): boolean {
  return network.toLowerCase() === MAINNET_NETWORK.toLowerCase();
}

export function isRinkeby(network: string): boolean {
  return network.toLowerCase() === RINKEBY_NETWORK.toLowerCase();
}

export function isWalletProvided(opts?: Partial<ClientOptions>): boolean {
  if (!opts) {
    return false;
  }
  return !!(opts.mnemonic || (opts.xpub && opts.keyGen));
}

export function shouldGenerateMnemonic(network: string, opts?: Partial<ClientOptions>): boolean {
  return !isMainnet(network) && !isWalletProvided(opts);
}

// getters

export function getOptionIfAvailable(option: string, opts?: Partial<ClientOptions>) {
  return opts && opts[option] ? opts[option] : undefined;
}

export function getDefaultStore(opts?: Partial<ClientOptions>): ConnextStore {
  const asyncStorage = getOptionIfAvailable("asyncStorage", opts);
  const backupService = getOptionIfAvailable("backupService", opts);
  return new ConnextStore(asyncStorage || window.localStorage, { backupService });
}

export async function getDefaultOptions(
  network: string,
  overrideOptions?: Partial<ClientOptions>,
): Promise<ClientOptions> {
  const baseUrl = isMainnet(network)
    ? "indra.connext.network/api"
    : isRinkeby(network)
    ? "rinkeby.indra.connext.network/api"
    : null;

  if (!baseUrl) {
    throw new Error(`Provided network (${network.toLowerCase()}) is not supported`);
  }

  const nodeUrlProtocol = isNode ? "nats" : "wss";

  const urlOptions = {
    ethProviderUrl: `https://${baseUrl}/ethprovider`,
    nodeUrl: `${nodeUrlProtocol}://${baseUrl}/messaging`,
  };

  const store = getOptionIfAvailable("store", overrideOptions) || getDefaultStore(overrideOptions);

  const mnemonic = shouldGenerateMnemonic(network, overrideOptions)
    ? Wallet.createRandom().mnemonic
    : undefined;

  const opts = {
    mnemonic,
    store,
    ...urlOptions,
    ...overrideOptions,
  };

  return opts;
}
