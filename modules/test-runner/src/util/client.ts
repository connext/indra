import { connect } from "@connext/client";
import { getLocalStore, getMemoryStore } from "@connext/store";
import {
  ClientOptions,
  IChannelProvider,
  IChannelSigner,
  IConnextClient,
  ProtocolParam,
  ProtocolNames,
  IStoreService,
} from "@connext/types";
import { ERC20 } from "@connext/contracts";
import {
  getRandomChannelSigner,
  ChannelSigner,
  ColorfulLogger,
  getRandomPrivateKey,
} from "@connext/utils";
import { expect } from "chai";
import { Contract, Wallet } from "ethers";

import { ETH_AMOUNT_LG, TOKEN_AMOUNT } from "./constants";
import { env } from "./env";
import { ethWallet } from "./ethprovider";
import { TestMessagingService, SendReceiveCounter, RECEIVED, SEND, NO_LIMIT } from "./messaging";

export const createClient = async (
  opts: Partial<ClientOptions & { id: string; logLevel: number }> = {},
  fund: boolean = true,
): Promise<IConnextClient> => {
  const store = opts.store || getMemoryStore();
  const log = new ColorfulLogger("CreateClient", opts.logLevel || env.logLevel);
  const clientOpts: ClientOptions = {
    ethProviderUrl: env.ethProviderUrl,
    loggerService: new ColorfulLogger("Client", opts.logLevel || env.logLevel, true, opts.id),
    signer: opts.signer || getRandomPrivateKey(),
    nodeUrl: env.nodeUrl,
    messagingUrl: env.natsUrl,
    store,
    ...opts,
  };
  log.info(`connect() called`);
  let start = Date.now();
  const client = await connect(clientOpts);
  log.info(`connect() returned after ${Date.now() - start}ms`);
  start = Date.now();
  if (fund) {
    log.info(`sending client eth`);
    const ethTx = await ethWallet.sendTransaction({
      to: client.signerAddress,
      value: ETH_AMOUNT_LG,
    });
    log.debug(`transaction sent ${ethTx.hash}, waiting...`);
    await ethTx.wait();
    const token = new Contract(client.config.contractAddresses.Token!, ERC20.abi, ethWallet);
    log.info(`sending client tokens`);
    const tokenTx = await token.transfer(client.signerAddress, TOKEN_AMOUNT);
    log.debug(`transaction sent ${tokenTx.hash}, waiting...`);
    await tokenTx.wait();
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
    messagingUrl: env.natsUrl,
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
    messagingUrl: env.natsUrl,
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
  ceiling: Partial<SendReceiveCounter>; // set ceiling of sent/received
  protocol: keyof typeof ProtocolNames | "any"; // use "any" to limit any messages by count
  signer: IChannelSigner;
  params: Partial<ProtocolParam>;
  store?: IStoreService;
};

export const createClientWithMessagingLimits = async (
  opts: Partial<ClientTestMessagingInputOpts> & { id?: string; logLevel?: number } = {},
): Promise<IConnextClient> => {
  const { protocol, ceiling, signer: signerOpts, params } = opts;
  const signer = signerOpts || getRandomChannelSigner(env.ethProviderUrl);
  // no defaults specified, exit early
  if (Object.keys(opts).length === 0) {
    const messaging = new TestMessagingService({ signer: signer as ChannelSigner });
    const emptyCount = { [SEND]: 0, [RECEIVED]: 0 };
    const noLimit = { [SEND]: NO_LIMIT, [RECEIVED]: NO_LIMIT };
    expect(messaging.installCount).to.contain(emptyCount);
    expect(messaging.installLimit.ceiling).to.contain(noLimit);
    expect(messaging.installLimit.params).to.be.undefined;
    expect(messaging.apiCount).to.containSubset(emptyCount);
    return createClient({ messaging, signer });
  }
  const messageOptions = {} as any;
  if (protocol === "any" && ceiling) {
    // assign the ceiling for the general message count
    // by default, only use the send and receive methods here
    messageOptions.apiLimits = {
      [SEND]: { ceiling: ceiling[SEND] || NO_LIMIT },
      [RECEIVED]: { ceiling: ceiling[RECEIVED] || NO_LIMIT },
    };
  } else if (protocol && typeof protocol === "string") {
    // assign the protocol defaults struct
    messageOptions.protocolLimits = {
      [protocol!]: {
        ceiling,
        params,
      },
    };
  }
  const messaging = new TestMessagingService({ ...messageOptions, signer });
  // verification of messaging settings
  const expectedCount = {
    [SEND]: 0,
    [RECEIVED]: 0,
  };
  const expectedLimits = {
    ceiling,
  };
  !protocol || protocol === "any"
    ? expect(messaging.apiCount).to.containSubset(expectedCount)
    : expect(messaging.protocolCount[protocol as string]).to.containSubset(expectedCount);
  !protocol || protocol === "any"
    ? expect(messaging.apiLimits).to.containSubset(expectedLimits)
    : expect(messaging.protocolLimits[protocol as string]).to.containSubset({
        ...expectedLimits,
        params,
      });
  expect(messaging.providedOptions).to.containSubset(messageOptions);
  return createClient({
    messaging,
    signer: signer,
    store: opts.store,
    id: opts.id,
    logLevel: opts.logLevel,
  });
};
