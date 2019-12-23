import { connect } from "@connext/client";
import { ClientOptions, IConnextClient } from "@connext/types";
import { Wallet } from "ethers";

import { MemoryStoreServiceFactory } from "./store";

export const createClient = async (
  mnemonic: string = Wallet.createRandom().mnemonic,
): Promise<IConnextClient> => {
  const storeServiceFactory = new MemoryStoreServiceFactory();

  const clientStore = storeServiceFactory.createStoreService();
  const clientOpts: ClientOptions = {
    ethProviderUrl: process.env.INDRA_ETH_RPC_URL!,
    logLevel: parseInt(process.env.INDRA_CLIENT_LOG_LEVEL!, 10),
    mnemonic,
    nodeUrl: process.env.INDRA_NATS_SERVERS,
    store: clientStore,
  };
  const client = await connect(clientOpts);

  // TODO: add client endpoint to get node config, so we can easily have its xpub etc

  await client.isAvailable();

  expect(client.freeBalanceAddress).toBeTruthy();
  expect(client.publicIdentifier).toBeTruthy();

  return client;
};
