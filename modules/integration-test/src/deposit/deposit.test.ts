import { connect } from "@connext/client";
import { ClientOptions, IConnextClient } from "@connext/types";
import { AddressZero } from "ethers/constants";

import { clearDb } from "../util/db";
import { MemoryStoreServiceFactory } from "../util/store";

describe("Deposits", () => {
  let clientA: IConnextClient;
  beforeAll(async () => {
    // TODO: clearDb doesnt work between test runs because it deletes necessary things
    // such as app registry. need to snapshot the db instead.
    // await clearDb();

    const storeServiceFactory = new MemoryStoreServiceFactory();

    // client A
    const clientAStore = storeServiceFactory.createStoreService();
    const clientAOpts: ClientOptions = {
      ethProviderUrl: "http://localhost:8545",
      logLevel: 4,
      mnemonic:
        "humble sense shrug young vehicle assault destroy cook property average silent travel",
      nodeUrl: "nats://localhost:4222",
      store: clientAStore,
    };
    clientA = await connect(clientAOpts);

    // TODO: add client endpoint to get node config, so we can easily have its xpub etc

    await clientA.isAvailable();

    expect(clientA.freeBalanceAddress).toBeTruthy();
    expect(clientA.publicIdentifier).toBeTruthy();
  }, 90_000);

  test("client A should deposit ETH", async () => {
    const depositResult = await clientA.deposit({ amount: "1", assetId: AddressZero });
    console.log("depositResult: ", depositResult);
    const freeBalance = await clientA.getFreeBalance(AddressZero);

    expect(freeBalance[clientA.freeBalanceAddress].toNumber()).toEqual(1);

    // TODO: add node endpoint to get free balance and assert it's 0
  }, 30_000);
});
