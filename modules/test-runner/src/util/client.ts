import { connect } from "@connext/client";
import { getLocalStore, getMemoryStore } from "@connext/store";
import {
  ClientOptions,
  IChannelProvider,
  IChannelSigner,
  IConnextClient,
} from "@connext/types";
import { getRandomChannelSigner, ChannelSigner, ColorfulLogger } from "@connext/utils";
import { expect } from "chai";
import { Contract, Wallet } from "ethers";
import tokenAbi from "human-standard-token-abi";

import { ETH_AMOUNT_LG, TOKEN_AMOUNT } from "./constants";
import { env } from "./env";
import { ethWallet } from "./ethprovider";
import { MessageCounter, TestMessagingService } from "./messaging";

export const createClient = async (
  opts: Partial<ClientOptions & { id: string }> = {},
  fund: boolean = true,
): Promise<IConnextClient> => {
  const store = opts.store || getMemoryStore();
  const wallet = Wallet.createRandom();
  const log = new ColorfulLogger("CreateClient", env.logLevel);
  const clientOpts: ClientOptions = {
    ethProviderUrl: env.ethProviderUrl,
    loggerService: new ColorfulLogger("Client", env.logLevel, true, opts.id),
    signer: wallet.privateKey,
    nodeUrl: env.nodeUrl,
    store,
    ...opts,
  };
  log.info(`connect() called`);
  let start = Date.now();
  const client = await connect(clientOpts);
  log.info(`connect() returned after ${Date.now() - start}ms`);
  start = Date.now();

  const ethTx = await ethWallet.sendTransaction({
    to: client.signerAddress,
    value: ETH_AMOUNT_LG,
  });
  if (fund) {
    const token = new Contract(client.config.contractAddresses.Token, tokenAbi, ethWallet);
    const tokenTx = await token.functions.transfer(client.signerAddress, TOKEN_AMOUNT);
    await Promise.all([ethTx.wait(), tokenTx.wait()]);
  }
  expect(client.signerAddress).to.be.ok;
  expect(client.publicIdentifier).to.be.ok;
  expect(client.multisigAddress).to.be.ok;
  return client;
};

export const createRemoteClient = async (
  channelProvider: IChannelProvider,
): Promise<IConnextClient> => {
  const clientOpts: ClientOptions = {
    channelProvider,
    ethProviderUrl: env.ethProviderUrl,
    loggerService: new ColorfulLogger("TestRunner", env.logLevel, true),
  };
  const client = await connect(clientOpts);
  expect(client.signerAddress).to.be.ok;
  expect(client.publicIdentifier).to.be.ok;
  return client;
};

export const createDefaultClient = async (network: string, opts?: Partial<ClientOptions>) => {
  // TODO: allow test-runner to access external urls
  const urlOptions = {
    ethProviderUrl: env.ethProviderUrl,
    nodeUrl: env.nodeUrl,
  };
  let clientOpts: Partial<ClientOptions> = {
    ...opts,
    ...urlOptions,
    loggerService: new ColorfulLogger("TestRunner", env.logLevel, true),
    store: getLocalStore(), // TODO: replace with polyfilled window.localStorage
  };
  if (network === "mainnet") {
    clientOpts = {
      signer: Wallet.createRandom().privateKey,
      ...clientOpts,
    };
  }
  const client = await connect(network, clientOpts);
  expect(client.signerAddress).to.be.ok;
  expect(client.publicIdentifier).to.be.ok;
  return client;
};

export type ClientTestMessagingInputOpts = {
  ceiling: Partial<MessageCounter>; // set ceiling of sent/received
  protocol: string; // use "any" to limit any messages by count
  delay: Partial<MessageCounter>; // ms delay or sent callbacks
  signer: IChannelSigner;
};

export const createClientWithMessagingLimits = async (
  opts: Partial<ClientTestMessagingInputOpts> = {},
): Promise<IConnextClient> => {
  const { protocol, ceiling, delay, signer: signerOpts } = opts;
  const signer = signerOpts || getRandomChannelSigner(env.ethProviderUrl);
  const messageOptions: any = {};
  // no defaults specified, exit early
  if (Object.keys(opts).length === 0) {
    const messaging = new TestMessagingService({ signer: signer as ChannelSigner });
    expect(messaging.install.ceiling).to.be.undefined;
    expect(messaging.count.received).to.be.equal(0);
    expect(messaging.count.sent).to.be.equal(0);
    return createClient({ messaging, signer });
  }
  if (protocol === "any") {
    // assign the ceiling for the general message count
    messageOptions.count = { ceiling, delay };
  } else if (protocol && typeof protocol === "string") {
    // assign the protocol defaults struct
    messageOptions.protocolDefaults = {
      [protocol]: {
        ceiling,
        delay,
      },
    };
  }
  const messaging = new TestMessagingService({ ...messageOptions, signer });
  // verification of messaging settings
  const expected = {
    sent: 0,
    received: 0,
    ceiling,
    delay,
  };
  !protocol || protocol === "any"
    ? expect(messaging.count).to.containSubset(expected)
    : expect(messaging[protocol]).to.containSubset(expected);
  expect(messaging.options).to.containSubset(messageOptions);
  return createClient({ messaging, signer: signer });
};
