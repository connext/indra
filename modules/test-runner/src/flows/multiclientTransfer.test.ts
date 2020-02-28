import { IConnextClient } from "@connext/types";
import { Client } from "ts-nats";
import { before, after } from "mocha";
import { AddressZero } from "ethers/constants";
import {
  createClient,
  fundChannel,
  ETH_AMOUNT_SM,
  requestCollateral,
  asyncTransferAsset,
  TOKEN_AMOUNT_SM,
  connectNats,
  closeNats,
} from "../util";
import { parseEther } from "ethers/utils";

describe("Full Flow: Transfer", () => {
  let gateway: IConnextClient;
  let indexerA: IConnextClient;
  let indexerB: IConnextClient;
  let clientD: IConnextClient;
  let tokenAddress: string;
  let nats: Client;

  before(async () => {
    nats = await connectNats();
  });

  beforeEach(async () => {
    gateway = await createClient();
    indexerA = await createClient();
    indexerB = await createClient();
    tokenAddress = gateway.config.contractAddresses.Token;
  });

  afterEach(async () => {
    await gateway.messaging.disconnect();
    await indexerA.messaging.disconnect();
    await indexerB.messaging.disconnect();
    await clientD.messaging.disconnect();
  });

  after(() => {
    closeNats();
  });

  it("Clients transfer assets between themselves", async () => {
    await fundChannel(gateway, parseEther("100"));
  });
});
