import { ConnextStore } from "@connext/store";
import { Store } from "@connext/types";
import { ethers } from "ethers";

import { Logger } from "./logger";
import { ClientOptions } from "../types";

// constants

export const MNEMONIC_KEY = "CONNEXT_MNEMONIC";
export const MAINNET_NETWORK = "mainnet";
export const RINKEBY_NETWORK = "rinkeby";

// helpers

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

export function generateMnemonic(): string {
  const entropy = ethers.utils.randomBytes(16);
  const mnemonic = ethers.utils.HDNode.entropyToMnemonic(entropy);
  return mnemonic;
}

// getters

export async function getDefaultMnemonic(store: Store, log: Logger): Promise<string> {
  log.warn("Using mnemonic stored insecurely - DO NOT USE IN PRODUCTION!");

  let mnemonic = await store.get(MNEMONIC_KEY);

  if (!mnemonic) {
    mnemonic = generateMnemonic();
    await store.set([{ path: MNEMONIC_KEY, value: mnemonic }]);
  }
  return mnemonic;
}

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
  const logLevel = overrideOptions ? overrideOptions.logLevel : undefined;
  const log = new Logger("ConnextConnect", logLevel);

  const baseUrl = isMainnet(network)
    ? "indra.connext.network/api"
    : isRinkeby(network)
    ? "rinkeby.indra.connext.network/api"
    : null;

  log.debug(`Using default baseUrl: ${baseUrl}`);

  if (!baseUrl) {
    throw new Error(`Provided network (${network.toLowerCase()}) is not supported`);
  }

  const urlOptions = {
    ethProviderUrl: `https://${baseUrl}/ethprovider`,
    nodeUrl: `wss://${baseUrl}/messaging`,
  };

  log.debug(`Using default urlOptions: ${JSON.stringify(urlOptions, null, 2)}`);

  const store = getOptionIfAvailable("store", overrideOptions) || getDefaultStore(overrideOptions);

  const mnemonic = shouldGenerateMnemonic(network, overrideOptions) ? await getDefaultMnemonic(store, log) : undefined;

  log.debug(`Using default store: ${JSON.stringify(store, null, 2)}`);

  log.debug(`Using default mnemonic: ${mnemonic}`);

  const opts = {
    mnemonic,
    store,
    ...urlOptions,
    ...overrideOptions,
  };

  log.debug(`Using default opts: ${JSON.stringify(opts, null, 2)}`);

  return opts;
}
