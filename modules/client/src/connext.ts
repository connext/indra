import { NatsServiceFactory } from "@connext/nats-messaging-client";
import { Node } from "@counterfactual/node";
import { EventEmitter } from "events";
import { Client as NatsClient } from "ts-nats";

import { DepositController } from "./controllers/DepositController";
import { ExchangeController } from "./controllers/ExchangeController";
import { TransferController } from "./controllers/TransferController";
import { WithdrawalController } from "./controllers/WithdrawalController";
import { Logger } from "./lib/logger";
import { createAccount, getMultisigAddress } from "./lib/utils";
import { INodeApiClient, NodeApiClient } from "./node";
import {
  ChannelState,
  ClientOptions,
  DepositParameters,
  ExchangeParameters,
  InternalClientOptions,
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
    servers: [opts.nodeUrl],
    token: opts.natsToken,
  };
  // TODO: proper key? also, proper usage?
  const messagingServiceKey = "messagingServiceKey";
  // connect nats service, done as part of async setup

  // TODO: get config from nats client?
  const nats = new NatsServiceFactory(natsConfig).createMessagingService(messagingServiceKey);
  await nats.connect();

  // create a new node api instance
  // TODO: use local storage for default key value setting!!
  const node: NodeApiClient = new NodeApiClient({
    logLevel: opts.logLevel,
    nats: nats.getConnection(),
    nodeUrl: opts.nodeUrl,
    wallet,
  });
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

  // create new cfModule to inject into internal instance
  const cfModule = await Node.create(
    nats,
    opts.store,
    {
      STORE_KEY_PREFIX: "store",
    }, // TODO: proper config
    // @ts-ignore WHYYYYYYYYY
    wallet.provider,
    "kovan", // TODO: make this not hardcoded to "kovan"
  );

  // TODO this will disappear once we start generating multisig internally and
  // deploying on withdraw only do we need to save temp?
  const temp = await createAccount(opts.nodeUrl || "http://localhost:8080", {
    xpub: cfModule.publicIdentifier,
  });
  console.log(temp);

  // TODO replace this with nats url once this path is built
  const multisigAddress = await getMultisigAddress(
    opts.nodeUrl || "http://localhost:8080",
    cfModule.publicIdentifier,
  );

  // create the new client
  return new ConnextInternal({
    cfModule,
    multisigAddress,
    nats: nats.getConnection(),
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
  public deposit(params: DepositParameters): Promise<ChannelState> {
    return this.internal.deposit(params);
  }

  public exchange(params: ExchangeParameters): Promise<ChannelState> {
    return this.internal.exchange(params);
  }

  public transfer(params: TransferParameters): Promise<ChannelState> {
    return this.internal.transfer(params);
  }

  public withdrawal(params: WithdrawParameters): Promise<ChannelState> {
    return this.internal.withdraw(params);
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
  public node: INodeApiClient;
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

  public deposit(params: DepositParameters): Promise<ChannelState> {
    return this.depositController.deposit(params);
  }

  public exchange(params: ExchangeParameters): Promise<ChannelState> {
    return this.exchangeController.exchange(params);
  }

  public transfer(params: TransferParameters): Promise<ChannelState> {
    return this.transferController.transfer(params);
  }

  public withdraw(params: WithdrawParameters): Promise<ChannelState> {
    return this.withdrawalController.withdraw(params);
  }

  ///////////////////////////////////
  // NODE METHODS

  ///////////////////////////////////
  // LOW LEVEL METHODS
}
