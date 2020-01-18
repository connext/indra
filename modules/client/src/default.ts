import { ConnextStore } from "@connext/store";
import { ethers } from "ethers";

import { ClientOptions } from "./types";

// constants

const MNEMONIC_KEY = "MNEMONIC";
const MAINNET = "mainnet";
const RINKEBY = "rinkeby";

// validators

export function isMainnet(network: string): boolean {
  return network.toLowerCase() === MAINNET;
}

export function isRinkeby(network: string): boolean {
  return network.toLowerCase() === RINKEBY;
}

export function isWalletProvided(opts?: Partial<ClientOptions>): boolean {
  if (!opts) {
    return false;
  }
  return !!(opts.mnemonic || (opts.xpub && opts.keyGen));
}

// methods

export function generateMnemonic(): string {
  const entropy = ethers.utils.randomBytes(16);
  const mnemonic = ethers.utils.HDNode.entropyToMnemonic(entropy);
  return mnemonic;
}

export async function getDefaultMnemonic(store: ConnextStore): Promise<string> {
  console.warn("[Connext] Using mnemonic stored insecurely - DO NOT USE IN PRODUCTION!");

  let mnemonic = await store.get(MNEMONIC_KEY);

  if (!mnemonic) {
    mnemonic = generateMnemonic();
    store.set([{ path: MNEMONIC_KEY, value: mnemonic }]);
  }
  return mnemonic;
}

export function shouldGenerateMnemonic(network: string, opts?: Partial<ClientOptions>): boolean {
  return !isMainnet(network) && !isWalletProvided(opts);
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

  const urlOptions = {
    ethProviderUrl: `https://${baseUrl}/ethprovider`,
    nodeUrl: `wss://${baseUrl}/messaging`,
  };

  const asyncStorage = overrideOptions ? overrideOptions.asyncStorage : undefined;
  const store = new ConnextStore(asyncStorage || window.localStorage);

  const mnemonic = shouldGenerateMnemonic ? await getDefaultMnemonic(store) : undefined;

  return {
    mnemonic,
    store,
    ...urlOptions,
    ...overrideOptions,
  };
}
