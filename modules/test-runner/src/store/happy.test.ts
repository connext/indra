import { getLocalStore } from "@connext/store";
import { IConnextClient } from "@connext/types";
import { constants } from "ethers";

import {
  asyncTransferAsset,
  createClient,
  ETH_AMOUNT_SM,
  fundChannel,
  getTestLoggers,
  requestCollateral,
} from "../util";

const { AddressZero } = constants;

const name = "Happy Store";
const { timeElapsed } = getTestLoggers(name);
describe(name, () => {
  let clientA: IConnextClient;
  let clientB: IConnextClient;
  let start: number;

  beforeEach(async () => {
    start = Date.now();
    clientA = await createClient({ id: "A" });
    clientB = await createClient({ id: "B" });
    timeElapsed("beforeEach complete", start);
  });

  afterEach(async () => {
    await clientA.off();
    await clientB.off();
  });

  it("client A transfers eth to client B through node with localstorage", async () => {
    const localStorageClient = await createClient({ store: getLocalStore() });
    const transfer = { amount: ETH_AMOUNT_SM, assetId: AddressZero };
    await fundChannel(localStorageClient, transfer.amount, transfer.assetId);
    await requestCollateral(clientB, transfer.assetId);
    await asyncTransferAsset(localStorageClient, clientB, transfer.amount, transfer.assetId);
  });

});

