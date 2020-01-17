import { connect } from "@connext/client";
import { ConnextStore, MemoryStorage } from "@connext/store";
import { ClientOptions, IChannelProvider, IConnextClient, IMessagingService } from "@connext/types";
import { expect } from "chai";
import { Contract, Wallet } from "ethers";
import tokenAbi from "human-standard-token-abi";

import { ETH_AMOUNT_MD, TOKEN_AMOUNT } from "./constants";
import { env } from "./env";
import { ethWallet } from "./ethprovider";
import { TestMessagingService } from "./messaging";

let clientStore: ConnextStore;
let clientMessaging: TestMessagingService;

export const getStore = (): ConnextStore => {
  return clientStore;
};

export const getMessaging = (): TestMessagingService => {
  return clientMessaging;
};

export const createClient = async (opts?: Partial<ClientOptions>): Promise<IConnextClient> => {
  const memoryStorage = new MemoryStorage();

  clientStore = new ConnextStore(memoryStorage);

  const clientOpts: ClientOptions = {
    ethProviderUrl: env.ethProviderUrl,
    logLevel: env.logLevel,
    mnemonic: Wallet.createRandom().mnemonic,
    nodeUrl: env.nodeUrl,
    store: clientStore,
    ...opts,
  };
  clientMessaging = new TestMessagingService({
    logLevel: clientOpts.logLevel!,
    messagingUrl: clientOpts.nodeUrl!,
  });
  const client = await connect({ ...clientOpts, messaging: clientMessaging });
  // TODO: add client endpoint to get node config, so we can easily have its xpub etc

  const ethTx = await ethWallet.sendTransaction({
    to: client.signerAddress,
    value: ETH_AMOUNT_MD,
  });
  const token = new Contract(client.config.contractAddresses.Token, tokenAbi, ethWallet);
  const tokenTx = await token.functions.transfer(client.signerAddress, TOKEN_AMOUNT);

  await Promise.all([ethTx.wait(), tokenTx.wait()]);

  expect(client.freeBalanceAddress).to.be.ok;
  expect(client.publicIdentifier).to.be.ok;

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

  expect(client.freeBalanceAddress).to.be.ok;
  expect(client.publicIdentifier).to.be.ok;

  return client;
};
