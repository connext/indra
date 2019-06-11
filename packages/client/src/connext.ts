import { ClientOptions, NodeConfig } from "./types";
import { NodeApiClient } from "./node";

/**
 * Creates a new client-node connection with node at specified url
 * 
 * @param opts The options to instantiate the client with. At a minimum, must contain the nodeUrl and a client signing key or mnemonic
 */

// TODO: decide on how to do the exports
export async function connect(opts: ClientOptions): Promise<NodeConfig> {
  // create a new internal hub instance
  const node: NodeApiClient = new NodeApiClient(opts.nodeUrl, )
  // get the hub supported configuration
  const nodeConfig: NodeConfig = await node.config()
  return nodeConfig
}