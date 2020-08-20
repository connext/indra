import { connect } from "@connext/client";
import { getMemoryStore } from "@connext/store";
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
  getRandomBytes32,
} from "@connext/utils";
import { expect } from "chai";
import { Contract, Wallet } from "ethers";

import { ETH_AMOUNT_LG, TOKEN_AMOUNT } from "./constants";
import { env } from "./env";
import { ethProviderUrl, ethWallet } from "./ethprovider";
import { getTestLoggers } from "./misc";
import { TestMessagingService, SendReceiveCounter, RECEIVED, SEND, NO_LIMIT } from "./messaging";

const { log, timeElapsed } = getTestLoggers("ClientHelper");

export const createClient = async (
  opts: Partial<ClientOptions & { id: string }> = {},
  fund: boolean = true,
): Promise<IConnextClient> => {
  const start = Date.now();
  const store = opts.store || getMemoryStore({ prefix: getRandomBytes32() });
  await store.init();
  const client = await connect({
    ...opts,
    ethProviderUrl: opts.ethProviderUrl || ethProviderUrl,
    loggerService: new ColorfulLogger("Client", env.clientLogLevel, true, opts.id),
    signer: opts.signer || getRandomPrivateKey(),
    nodeUrl: opts.nodeUrl || env.nodeUrl,
    messagingUrl: opts.messagingUrl || env.natsUrl,
    store,
  });

  if (fund) {
    const tokenAddress = client.config.contractAddresses[client.chainId].Token!;
    const token = new Contract(tokenAddress, ERC20.abi, ethWallet);
    const [ethTx, tokenTx] = await Promise.all([
      await ethWallet.sendTransaction({
        to: client.signerAddress,
        value: ETH_AMOUNT_LG,
      }),
      await token.transfer(client.signerAddress, TOKEN_AMOUNT),
    ]);
    log.debug(
      `Sent ${tokenAddress} tokens on chain ${client.chainId} from funding account ${
        ethWallet.address
      } with balance ${await token.balanceOf(ethWallet.address)} via tx ${tokenTx.hash}`,
    );
    await Promise.all([ethTx.wait(), tokenTx.wait()]);
  }

  expect(client.signerAddress).to.be.ok;
  expect(client.publicIdentifier).to.be.ok;
  expect(client.multisigAddress).to.be.ok;
  timeElapsed(`Created client ${client.publicIdentifier}`, start);
  return client;
};

export const createRemoteClient = async (
  channelProvider: IChannelProvider,
): Promise<IConnextClient> => {
  const client = await connect({
    channelProvider,
    ethProviderUrl: ethProviderUrl,
    loggerService: new ColorfulLogger("TestRunner", env.clientLogLevel, true),
    messagingUrl: env.natsUrl,
  });
  expect(client.signerAddress).to.be.ok;
  expect(client.publicIdentifier).to.be.ok;
  return client;
};

export const createDefaultClient = async (network: string, opts?: Partial<ClientOptions>) => {
  const urlOptions = {
    ethProviderUrl: ethProviderUrl,
    nodeUrl: env.nodeUrl,
    messagingUrl: env.natsUrl,
  };
  let clientOpts: Partial<ClientOptions> = {
    ...opts,
    ...urlOptions,
    loggerService: new ColorfulLogger("TestRunner", env.clientLogLevel, true),
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
  stopOnCeilingReached?: boolean;
};

export const createClientWithMessagingLimits = async (
  opts: Partial<ClientTestMessagingInputOpts> & { id?: string } = {},
): Promise<IConnextClient> => {
  const { protocol, ceiling, params } = opts;
  const signer = opts.signer || getRandomChannelSigner(ethProviderUrl);
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
  const messaging = new TestMessagingService({
    ...messageOptions,
    signer,
    stopOnCeilingReached: opts.stopOnCeilingReached,
  });
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
  });
};
