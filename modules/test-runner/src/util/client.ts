import { connect } from "@connext/client";
import { ClientOptions, IConnextClient } from "@connext/types";
import { Contract, Wallet } from "ethers";
import { JsonRpcProvider } from "ethers/providers";
import { parseEther } from "ethers/utils";
import tokenAbi from "human-standard-token-abi";

import { ChannelProvider } from "./channelProvider";
import { env } from "./env";
import { ethProvider } from "./ethprovider";
import { MemoryStoreServiceFactory } from "./store";

const wallet = Wallet.fromMnemonic(env.mnemonic).connect(ethProvider);

export const createClient = async (
  mnemonic: string = Wallet.createRandom().mnemonic,
): Promise<IConnextClient> => {
  const storeServiceFactory = new MemoryStoreServiceFactory();
  console.log("createClient", "storeServiceFactory", storeServiceFactory);

  const clientStore = storeServiceFactory.createStoreService();
  console.log("createClient", "clientStore", clientStore);

  const clientOpts: ClientOptions = {
    ethProviderUrl: env.ethProviderUrl,
    logLevel: env.logLevel,
    mnemonic,
    nodeUrl: env.nodeUrl,
    store: clientStore,
  };
  console.log("createClient", "clientOpts", clientOpts);

  const client = await connect(clientOpts);
  console.log("createClient", "client", client);
  // TODO: add client endpoint to get node config, so we can easily have its xpub etc

  await client.isAvailable();
  console.log("createClient", "isAvailable", true);

  const ethTx = await wallet.sendTransaction({
    to: client.signerAddress,
    value: parseEther("0.1"),
  });
  console.log("createClient", "ethTx", ethTx);

  const token = new Contract(client.config.contractAddresses.Token, tokenAbi, wallet);
  console.log("createClient", "token", token);

  const tokenTx = await token.functions.transfer(client.signerAddress, parseEther("10"));
  console.log("createClient", "tokenTx", tokenTx);

  await Promise.all([ethTx.wait(), tokenTx.wait()]);
  console.log("createClient", "Promise.all", true);

  expect(client.freeBalanceAddress).toBeTruthy();
  expect(client.publicIdentifier).toBeTruthy();
  return client;
};

export const createRemoteClient = async (
  channelProvider: ChannelProvider,
): Promise<IConnextClient> => {
  const clientOpts: ClientOptions = {
    channelProvider,
    ethProviderUrl: env.ethProviderUrl,
    logLevel: env.logLevel,
  };
  console.log("createRemoteClient", "clientOpts", clientOpts);

  const client = await connect(clientOpts);
  console.log("createRemoteClient", "client", client);

  await client.isAvailable();
  console.log("createRemoteClient", "isAvailable", true);

  expect(client.freeBalanceAddress).toBeTruthy();
  expect(client.publicIdentifier).toBeTruthy();

  return client;
};
