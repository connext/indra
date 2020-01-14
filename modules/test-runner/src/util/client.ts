import { connect } from "@connext/client";
import { ClientOptions, IChannelProvider, IConnextClient } from "@connext/types";
import { Contract, Wallet } from "ethers";
import tokenAbi from "human-standard-token-abi";

import { ETH_AMOUNT_MD, TOKEN_AMOUNT } from "./constants";
import { env } from "./env";
import { ethWallet } from "./ethprovider";
import { MemoryStoreService, MemoryStoreServiceFactory } from "./store";

let clientStore: MemoryStoreService;

export const getStore = (): MemoryStoreService => {
  return clientStore;
};

export const createClient = async (opts?: Partial<ClientOptions>): Promise<IConnextClient> => {
  const storeServiceFactory = new MemoryStoreServiceFactory();

  clientStore = storeServiceFactory.createStoreService();
  const clientOpts: ClientOptions = {
    ethProviderUrl: env.ethProviderUrl,
    logLevel: env.logLevel,
    mnemonic: Wallet.createRandom().mnemonic,
    nodeUrl: env.nodeUrl,
    store: clientStore,
    ...opts,
  };
  const client = await connect(clientOpts);
  // TODO: add client endpoint to get node config, so we can easily have its xpub etc

  await client.isAvailable();

  const ethTx = await ethWallet.sendTransaction({
    to: client.signerAddress,
    value: ETH_AMOUNT_MD,
  });
  const token = new Contract(client.config.contractAddresses.Token, tokenAbi, ethWallet);
  const tokenTx = await token.functions.transfer(client.signerAddress, TOKEN_AMOUNT);

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
