import { ClientOptions, InternalClientOptions, INodeAPIClient } from "./types";
import { NodeApiClient } from "./node";
import { Client as NatsClient } from 'ts-nats';
import { Wallet } from "./wallet";
import { Node as NodeTypes } from "@counterfactual/types";
import { Node } from "@counterfactual/node";
import { NatsServiceFactory, } from "../../nats-messaging-client"

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
  const node: NodeApiClient = new NodeApiClient(
    opts.nodeUrl, 
    nats, // converted to nats-client in ConnextInternal constructor
    wallet,
    opts.logLevel,
  );

  // create a new storage service for use by cfModule
  const store: NodeTypes.IStoreService = {

  } as NodeTypes.IStoreService

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
    nats,
    cfModule,
    ...opts, // use any provided opts by default
  })
}

/**
 * This abstract class contains all methods associated with managing
 * or establishing the user's channel.
 * 
 * The true implementation of this class exists in the
 */
export abstract class ConnextChannel {
  
}

/**
 * This abstract class contains all methods associated with managing
 * or establishing the user's channel.
 * 
 * The true implementation of this class exists in the
 */
export class ConnextInternal extends ConnextChannel {
  private opts: InternalClientOptions;
  private cfModule: Node;
  private wallet: Wallet;
  private node: INodeAPIClient;
  private nats: NatsClient;

  constructor(opts: InternalClientOptions) {
    super();

    this.opts = opts;

    this.wallet = opts.wallet;
    this.node = opts.node;
    this.nats = opts.nats.getConnection(); // returns natsclient

    this.cfModule = opts.cfModule;


  }
}