import { ConnextStore } from "@connext/store";
import { ethers } from "ethers";

import { ClientOptions } from "./types";

export function generateMnemonic(): string {
  const entropy = ethers.utils.randomBytes(16);
  const mnemonic = ethers.utils.HDNode.entropyToMnemonic(entropy);
  return mnemonic;
}

export async function getDefaultMnemonic(store: ConnextStore): Promise<string> {
  const MNEMONIC_KEY = "MNEMONIC";
  let mnemonic = await store.get(MNEMONIC_KEY);
  if (!mnemonic) {
    mnemonic = generateMnemonic();
    store.set([{ path: MNEMONIC_KEY, value: mnemonic }]);
  }
  return mnemonic;
}

export async function getDefaultOptions(
  network: string,
  overrideOptions?: ClientOptions,
): Promise<ClientOptions> {
  const baseUrl =
    network === "mainnet"
      ? "indra.connext.network/api"
      : network === "rinkeby"
      ? "rinkeby.indra.connext.network/api"
      : null;

  if (!baseUrl) {
    throw new Error(`Provided network (${network}) is not supported`);
  }

  const store = new ConnextStore(window.localStorage);
  const mnemonic = await getDefaultMnemonic(store);
  return {
    ethProviderUrl: `https://${baseUrl}/ethprovider`,
    mnemonic,
    nodeUrl: `wss://${baseUrl}/messaging`,
    store,
    ...overrideOptions,
  };
}
