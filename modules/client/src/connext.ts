import { ClientOptions, InternalClientOptions, INodeAPIClient, DepositParameters, ChannelState, ExchangeParameters, WithdrawParameters, TransferParameters } from "./types";
import { NodeApiClient } from "./node";
import { Client as NatsClient } from 'ts-nats';
import { Wallet } from "./wallet";
import { Node as NodeTypes } from "@counterfactual/types";
import { Node } from "@counterfactual/node";
import { NatsServiceFactory, } from "../../nats-messaging-client"
import { EventEmitter } from "events";
import { DepositController } from "./controllers/DepositController";
import { TransferController } from "./controllers/TransferController";
import { ExchangeController } from "./controllers/ExchangeController";
import { WithdrawalController } from "./controllers/WithdrawalController";
import { Logger } from "./lib/logger";

/**
 * Creates a new client-node connection with node at specified url
 * 
 * @param opts The options to instantiate the client with. At a minimum, must contain the nodeUrl and a client signing key or mnemonic
 */

export async function connect(opts: ClientOptions): Promise<ConnextInternal> {
  // create a new wallet
  const wallet = new Wallet(opts)

  // create a new internal nats instance
  const natsConfig = {
    clusterId: opts.natsClusterId,
    servers: [opts.nodeUrl],
    token: opts.natsToken,
  }
  // TODO: proper key? also, proper usage?
  const messagingServiceKey = "messagingServiceKey";
  // connect nats service, done as part of async setup

  // TODO: get config from nats client?
  const nats = new NatsServiceFactory(natsConfig)
    .createMessagingService(messagingServiceKey)
  await nats.connect()

  // create a new node api instance
  // TODO: use local storage for default key value setting!!
  const node: NodeApiClient = new NodeApiClient({
    nodeUrl: opts.nodeUrl, 
    nats: nats.getConnection(),
    wallet,
    logLevel: opts.logLevel,
  });

  const getFn = async (key: string) => {
    return await localStorage.get(key)
  }

  const setFn = async (pairs: {
    key: string;
    value: any;
  }[]) => {
    for (const pair of pairs) {
      await localStorage.setItem(pair.key, JSON.stringify(pair.value))
    }
    return
  }

  // create a new storage service for use by cfModule
  const store: NodeTypes.IStoreService = {
    get: opts.loadState || getFn,
    set: opts.saveState || setFn,
  }

  // create new cfModule to inject into internal instance
  const cfModule = await Node.create(
    nats, 
    store,
    {
      STORE_KEY_PREFIX: "store"
    }, // TODO: proper config
    wallet.provider,
    wallet.provider.network.name,
  )
  
  // create the new client
  return new ConnextInternal({
    node,
    wallet,
    nats: nats.getConnection(),
    cfModule,
    ...opts, // use any provided opts by default
  })
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
    this.internal = this as any
  }

  ///////////////////////////////////
  ///// CORE CHANNEL METHODS ///////
  /////////////////////////////////

  // TODO: do we want the inputs to be an object?
  public deposit(params: DepositParameters): Promise<ChannelState> {
    return this.internal.deposit(params)
  }

  public exchange(params: ExchangeParameters): Promise<ChannelState> {
    return this.internal.exchange(params)
  }

  public transfer(params: TransferParameters): Promise<ChannelState> {
    return this.internal.transfer(params)
  }

  public withdrawal(params: WithdrawParameters): Promise<ChannelState> {
    return this.internal.withdraw(params)
  }
}

/**
 * True implementation of the connext client
 */
export class ConnextInternal extends ConnextChannel {
  public opts: InternalClientOptions;
  private cfModule: Node;
  public publicIdentifier: string;
  public wallet: Wallet;
  public node: INodeAPIClient;
  public nats: NatsClient;

  private logger: Logger;

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

    this.logger = new Logger("ConnextInternal", opts.logLevel)

    // instantiate controllers with logger and cf
    this.depositController = new DepositController(opts.cfModule, opts.logLevel)
    this.transferController = new TransferController(opts.cfModule, opts.logLevel)
    this.exchangeController = new ExchangeController(opts.cfModule, opts.logLevel)
    this.withdrawalController = new WithdrawalController(opts.cfModule, opts.logLevel)
  }

  ///////////////////////////////////
  ///// CORE CHANNEL METHODS ///////
  /////////////////////////////////
  public deposit(params: DepositParameters): Promise<ChannelState> {
    return this.depositController.deposit(params)
  }

  public exchange(params: ExchangeParameters): Promise<ChannelState> {
    return this.exchangeController.exchange(params)
  }

  public transfer(params: TransferParameters): Promise<ChannelState> {
    return this.transferController.transfer(params)
  }

  public withdraw(params: WithdrawParameters): Promise<ChannelState> {
    return this.withdrawalController.withdraw(params)
  }

  ///////////////////////////////////
  ///////// NODE METHODS ///////////
  /////////////////////////////////


  ///////////////////////////////////
  //////// LOW LEVEL METHODS ///////
  /////////////////////////////////
}