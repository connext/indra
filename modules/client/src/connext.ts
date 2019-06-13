import { ClientOptions, NodeConfig, InternalClientOptions, INodeAPIClient } from "./types";
import { NodeApiClient } from "./node";
import { connect as natsConnect, Client as NatsClient } from 'ts-nats';
import { Wallet } from "./wallet";
import { Node } from "@counterfactual/node";
import { NatsServiceFactory, INatsMessaging } from "../../nats-messaging-client"

/**
 * Creates a new client-node connection with node at specified url
 * 
 * @param opts The options to instantiate the client with. At a minimum, must contain the nodeUrl and a client signing key or mnemonic
 */

export async function connect(opts: ClientOptions): Promise<ConnextInternal> {
  // create a new wallet
  const wallet = new Wallet(opts)
  // create a new internal hub instance
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
  const node: NodeApiClient = new NodeApiClient(
    opts.nodeUrl, 
    nats, // converted to nats-client in ConnextInternal constructor
    wallet,
    opts.logLevel,
  );
  
  // create the new client
  return new ConnextInternal({
    node,
    wallet,
    nats,
    ...opts,
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
  private opts: ClientOptions;
  private cfModule: Node;
  private wallet: Wallet;
  private node: INodeAPIClient;
  private nats: NatsClient;

  constructor(opts: InternalClientOptions) {
    super();

    this.opts = opts;

    this.wallet = opts.wallet;
    this.node = opts.node;
    this.nats = opts.nats.getConnection();

    // create new nats service factory

    // create counterfactual node
    // TODO: proper store service and config isht
    this.cfModule = Node.create(
      opts.nats, 
      {} as Node.IStoreService,
      {} as NodeConfig,
      opts.wallet.provider,
      opts.wallet.provider.network.name,
    )
  }
}