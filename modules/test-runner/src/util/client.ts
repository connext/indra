import { connect } from "@connext/client";
import { ClientOptions, IConnextClient } from "@connext/types";
import { Contract, Wallet } from "ethers";
import { parseEther } from "ethers/utils";
import tokenAbi from "human-standard-token-abi";

import { env } from "./env";
import { ethProvider } from "./ethprovider";
import { MemoryStoreService, MemoryStoreServiceFactory } from "./store";

export const ethWallet = Wallet.fromMnemonic(env.mnemonic).connect(ethProvider);

let clientStore: MemoryStoreService;

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
    value: parseEther("0.1"),
  });
  const token = new Contract(client.config.contractAddresses.Token, tokenAbi, ethWallet);
  const tokenTx = await token.functions.transfer(client.signerAddress, parseEther("10"));

  await Promise.all([ethTx.wait(), tokenTx.wait()]);

  expect(client.freeBalanceAddress).toBeTruthy();
  expect(client.publicIdentifier).toBeTruthy();

  return client;
};

export const getStore = (): MemoryStoreService => {
  return clientStore;
};
