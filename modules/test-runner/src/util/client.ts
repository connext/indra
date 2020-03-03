import { connect } from "@connext/client";
import { ConnextStore, MemoryStorage } from "@connext/store";
import { ClientOptions, IChannelProvider, IConnextClient } from "@connext/types";
import { expect } from "chai";
import { Contract, Wallet } from "ethers";
import tokenAbi from "human-standard-token-abi";
import localStorage from "localStorage";

import { ETH_AMOUNT_LG, TOKEN_AMOUNT } from "./constants";
import { env } from "./env";
import { ethWallet } from "./ethprovider";
import { Logger } from "./logger";
import { MessageCounter, TestMessagingService } from "./messaging";

let mnemonics: { [xpub: string]: string } = {};
export const getMnemonic = (xpub: string): string => {
  return mnemonics[xpub] || "";
};

export const createClient = async (
  opts: Partial<ClientOptions | any> = {},
): Promise<IConnextClient> => {
  const store = opts.store || new ConnextStore(new MemoryStorage());
  const mnemonic = opts.mnemonic || Wallet.createRandom().mnemonic;
  const log = new Logger("CreateClient", env.logLevel);
  const clientOpts: ClientOptions = {
    ethProviderUrl: env.ethProviderUrl,
    loggerService: new Logger("CreateClient", env.logLevel, true, opts.id),
    mnemonic,
    nodeUrl: env.nodeUrl,
    store,
    ...opts,
  };
  log.info(`connect() called`);
  let start = Date.now();
  const client = await connect(clientOpts);
  log.info(`connect() returned after ${Date.now() - start}ms`);
  start = Date.now();
  mnemonics[client.publicIdentifier] = mnemonic;

  const ethTx = await ethWallet.sendTransaction({
    to: client.signerAddress,
    value: ETH_AMOUNT_LG,
  });
  start = Date.now();

  const token = new Contract(client.config.contractAddresses.Token, tokenAbi, ethWallet);
  const tokenTx = await token.functions.transfer(client.signerAddress, TOKEN_AMOUNT);
  start = Date.now();

  await Promise.all([ethTx.wait(), tokenTx.wait()]);
  start = Date.now();

  expect(client.freeBalanceAddress).to.be.ok;
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
    loggerService: new Logger("TestRunner", env.logLevel, true),
  };
  const client = await connect(clientOpts);
  expect(client.freeBalanceAddress).to.be.ok;
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
    loggerService: new Logger("TestRunner", env.logLevel, true),
    store: new ConnextStore(localStorage), // TODO: replace with polyfilled window.localStorage
  };
  if (network === "mainnet") {
    clientOpts = {
      mnemonic: Wallet.createRandom().mnemonic,
      ...clientOpts,
    };
  }
  const client = await connect(network, clientOpts);
  expect(client.freeBalanceAddress).to.be.ok;
  expect(client.publicIdentifier).to.be.ok;
  return client;
};

export type ClientTestMessagingInputOpts = {
  ceiling: Partial<MessageCounter>; // set ceiling of sent/received
  protocol: string; // use "any" to limit any messages by count
  delay: Partial<MessageCounter>; // ms delay or sent callbacks
  forbiddenSubjects: string[];
};

export const createClientWithMessagingLimits = async (
  opts: Partial<ClientTestMessagingInputOpts> = {},
): Promise<IConnextClient> => {
  const { protocol, ceiling, delay, forbiddenSubjects } = opts;
  const messageOptions: any = { forbiddenSubjects: forbiddenSubjects || [] };
  // no defaults specified, exit early
  if (Object.keys(opts).length === 0) {
    const messaging = new TestMessagingService();
    expect(messaging.install.ceiling).to.be.undefined;
    expect(messaging.count.received).to.be.equal(0);
    expect(messaging.count.sent).to.be.equal(0);
    return await createClient({ messaging });
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
  const messaging = new TestMessagingService(messageOptions);
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
  return await createClient({ messaging });
};
