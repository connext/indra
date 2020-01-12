import { connect } from "@connext/client";
import { ClientOptions, IChannelProvider, IConnextClient } from "@connext/types";
import { Contract, Wallet } from "ethers";
import { parseEther } from "ethers/utils";
import tokenAbi from "human-standard-token-abi";

import { env } from "./env";
import { ethProvider } from "./ethprovider";
import { MemoryStoreService, MemoryStoreServiceFactory } from "./store";
import { TEST_ETH_AMOUNT_ALT, TEST_TOKEN_AMOUNT } from "./constants";

const wallet = Wallet.fromMnemonic(env.mnemonic).connect(ethProvider);

let clientStore: MemoryStoreService;

export const getStore = (): MemoryStoreService => {
  return clientStore;
};

export const createClient = async (
  mnemonic: string = Wallet.createRandom().mnemonic,
): Promise<IConnextClient> => {
  const storeServiceFactory = new MemoryStoreServiceFactory();

  clientStore = storeServiceFactory.createStoreService();
  const clientOpts: ClientOptions = {
    ethProviderUrl: env.ethProviderUrl,
    logLevel: env.logLevel,
    mnemonic,
    nodeUrl: env.nodeUrl,
    store: clientStore,
  };
  const client = await connect(clientOpts);
  // TODO: add client endpoint to get node config, so we can easily have its xpub etc

  await client.isAvailable();

  const ethTx = await wallet.sendTransaction({
    to: client.signerAddress,
    value: TEST_ETH_AMOUNT_ALT,
  });
  const token = new Contract(client.config.contractAddresses.Token, tokenAbi, wallet);
  const tokenTx = await token.functions.transfer(client.signerAddress, TEST_TOKEN_AMOUNT);

  await Promise.all([ethTx.wait(), tokenTx.wait()]);

  expect(client.freeBalanceAddress).toBeTruthy();
  expect(client.publicIdentifier).toBeTruthy();

  return client;
};

export const createRemoteClient = async (
  channelProvider: IChannelProvider,
): Promise<IConnextClient> => {
  const clientOpts: ClientOptions = {
    channelProvider,
    ethProviderUrl: env.ethProviderUrl,
    logLevel: env.logLevel,
  };

  const client = await connect(clientOpts);

  await client.isAvailable();

  expect(client.freeBalanceAddress).toBeTruthy();
  expect(client.publicIdentifier).toBeTruthy();

  return client;
};
