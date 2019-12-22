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
    ethProviderUrl: "http://localhost:8545",
    logLevel: 4,
    mnemonic,
    nodeUrl: "nats://localhost:4222",
    store: clientStore,
  };
  const client = await connect(clientOpts);

  // TODO: add client endpoint to get node config, so we can easily have its xpub etc

  await client.isAvailable();

  expect(client.freeBalanceAddress).toBeTruthy();
  expect(client.publicIdentifier).toBeTruthy();

  return client;
};
