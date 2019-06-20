import { NatsServiceFactory } from "@connext/nats-messaging-client";
import { MNEMONIC_PATH, Node } from "@counterfactual/node";
import { EventEmitter } from "events";
import { Client as NatsClient } from "ts-nats";

import { DepositController } from "./controllers/DepositController";
import { ExchangeController } from "./controllers/ExchangeController";
import { TransferController } from "./controllers/TransferController";
import { WithdrawalController } from "./controllers/WithdrawalController";
import { Logger } from "./lib/logger";
import { createAccount, getMultisigAddress } from "./lib/utils";
import { NodeApiClient } from "./node";
import {
  ChannelState,
  ClientOptions,
  DepositParameters,
  ExchangeParameters,
  InternalClientOptions,
  NodeConfig,
  TransferParameters,
  WithdrawParameters,
} from "./types";
import { Wallet } from "./wallet";

/**
 * Creates a new client-node connection with node at specified url
 *
 * @param opts The options to instantiate the client with.
 *        At a minimum, must contain the nodeUrl and a client signing key or mnemonic
 */

export async function connect(opts: ClientOptions): Promise<ConnextInternal> {
  // create a new wallet
  const wallet = new Wallet(opts);

  // create a new internal nats instance
  const natsConfig = {
    clusterId: opts.natsClusterId,
    servers: [opts.natsUrl],
    token: opts.natsToken,
  };
  // TODO: proper key? also, proper usage?
  const messagingServiceKey = "messaging";
  // connect nats service, done as part of async setup

  // TODO: get config from nats client?
  console.log("creating nats client from config:", JSON.stringify(natsConfig));
  // TODO: instantiate service factory with proper config!!
  // @ts-ignore
  const natsFactory = new NatsServiceFactory(natsConfig);
  const messaging = natsFactory.createMessagingService(messagingServiceKey);
  await messaging.connect();
  console.log("nats is connected");

  // create a new node api instance
  // TODO: use local storage for default key value setting!!
  const nodeConfig = {
    logLevel: opts.logLevel,
    nats: messaging.getConnection(),
    nodeUrl: opts.nodeUrl,
    wallet,
  };
  console.log("creating node");
  const node: NodeApiClient = new NodeApiClient(nodeConfig);
  console.log("created node successfully");

  // TODO: we need to pass in the whole store to retain context. Figure out how to do this better
  // const getFn = async (key: string) => {
  //   return await localStorage.get(key)
  // }

  // const setFn = async (pairs: {
  //   key: string;
  //   value: any;
  // }[]) => {
  //   for (const pair of pairs) {
  //     await localStorage.setItem(pair.key, JSON.stringify(pair.value))
  //   }
  //   return
  // }

  // // create a new storage service for use by cfModule
  // const store: NodeTypes.IStoreService = {
  //   get: opts.loadState || getFn,
  //   set: opts.saveState || setFn,
  // }

  // Note: added this to the client since this is required for the cf module to work
  await opts.store.set([{ key: MNEMONIC_PATH, value: opts.mnemonic }]);

  // create new cfModule to inject into internal instance
  console.log("creating new cf module");
  const cfModule = await Node.create(
    messaging,
    opts.store,
    {
      STORE_KEY_PREFIX: "store",
    }, // TODO: proper config
    // @ts-ignore WHYYYYYYYYY
    wallet.provider,
    "kovan", // TODO: make this not hardcoded to "kovan"
  );
  console.log("created cf module successfully");

  // TODO make these types
  const getChannelResponse = await node.getChannel(cfModule.publicIdentifier);
  console.log("getChannelResponse: ", getChannelResponse);
  let myChannel = getChannelResponse.data;

  if (!myChannel.xpub) {
    // TODO make these types
    const createChannelResponse = await node.createChannel(cfModule.publicIdentifier);
    myChannel = createChannelResponse.data;
  }
  console.log("myChannel: ", myChannel);
  // @ts-ignore

  // create the new client
  console.log("creating new instance of connext internal");
  return new ConnextInternal({
    cfModule,
    // warning myChannel response structure will change
    multisigAddress: myChannel.channels[0].multisigAddress,
    nats: messaging.getConnection(),
    node,
    wallet,
    ...opts, // use any provided opts by default
  });
}

/**
 * This abstract class contains all methods associated with managing
 * or establishing the user's channel.
 *
 * The true implementation of this class exists in the `ConnextInternal`
 * class
 */
export abstract class ConnextChannel extends EventEmitter {
  public opts: InternalClientOptions;
  private internal: ConnextInternal;

  public constructor(opts: InternalClientOptions) {
    super();
    this.opts = opts;
    this.internal = this as any;
  }

  ///////////////////////////////////
  // CORE CHANNEL METHODS

  // TODO: do we want the inputs to be an object?
  public async deposit(params: DepositParameters): Promise<ChannelState> {
    return await this.internal.deposit(params);
  }

  public async exchange(params: ExchangeParameters): Promise<ChannelState> {
    return await this.internal.exchange(params);
  }

  public async transfer(params: TransferParameters): Promise<ChannelState> {
    return await this.internal.transfer(params);
  }

  public async withdrawal(params: WithdrawParameters): Promise<ChannelState> {
    return await this.internal.withdraw(params);
  }

  ///////////////////////////////////
  // NODE EASY ACCESS METHODS
  public async config(): Promise<NodeConfig> {
    return await this.internal.config();
  }
}

/**
 * True implementation of the connext client
 */
export class ConnextInternal extends ConnextChannel {
  public opts: InternalClientOptions;
  public cfModule: Node;
  public publicIdentifier: string;
  public wallet: Wallet;
  public node: NodeApiClient;
  public nats: NatsClient;

  public logger: Logger;

  ////////////////////////////////////////
  // Setup channel controllers
  private depositController: DepositController;
  private transferController: TransferController;
  private exchangeController: ExchangeController;
  private withdrawalController: WithdrawalController;

  constructor(opts: InternalClientOptions) {
    super(opts);

    this.opts = opts;

    this.wallet = opts.wallet;
    this.node = opts.node;
    this.nats = opts.nats;

    this.cfModule = opts.cfModule;
    this.publicIdentifier = this.cfModule.publicIdentifier;

    this.logger = new Logger("ConnextInternal", opts.logLevel);

    // instantiate controllers with logger and cf
    this.depositController = new DepositController("DepositController", this);
    this.transferController = new TransferController("TransferController", this);
    this.exchangeController = new ExchangeController("ExchangeController", this);
    this.withdrawalController = new WithdrawalController("WithdrawalController", this);
  }

  ///////////////////////////////////
  // CORE CHANNEL METHODS

  public async deposit(params: DepositParameters): Promise<ChannelState> {
    return await this.depositController.deposit(params);
  }

  public async exchange(params: ExchangeParameters): Promise<ChannelState> {
    return await this.exchangeController.exchange(params);
  }

  public async transfer(params: TransferParameters): Promise<ChannelState> {
    return await this.transferController.transfer(params);
  }

  public async withdraw(params: WithdrawParameters): Promise<ChannelState> {
    return await this.withdrawalController.withdraw(params);
  }

  ///////////////////////////////////
  // NODE METHODS

  public async config(): Promise<NodeConfig> {
    return await this.node.config();
  }

  ///////////////////////////////////
  // LOW LEVEL METHODS
}
