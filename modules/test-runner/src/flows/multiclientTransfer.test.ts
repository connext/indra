import { IConnextClient, ReceiveTransferFinishedEventData } from "@connext/types";
import { Client } from "ts-nats";
import { before, after } from "mocha";
import { createClient, fundChannel, connectNats, closeNats } from "../util";
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

  it.only("Clients transfer assets between themselves", async function(done) {
    this.timeout(300_000);
    await fundChannel(gateway, parseEther("100"));
    gateway.on(
      "RECEIVE_TRANSFER_FINISHED_EVENT",
      async (data: ReceiveTransferFinishedEventData) => {
        const freeBalance = await gateway.getFreeBalance();
        if (freeBalance[gateway.freeBalanceAddress]) {
          done();
        }
        console.log("gateway received transfer: ", data);
        await gateway.transfer({
          amount: data.amount,
          recipient: data.sender,
        });
      },
    );

    indexerA.on(
      "RECEIVE_TRANSFER_FINISHED_EVENT",
      async (data: ReceiveTransferFinishedEventData) => {
        console.log("indexerA received transfer: ", data);
        await indexerA.transfer({
          amount: data.amount,
          recipient: data.sender,
        });
      },
    );

    indexerB.on(
      "RECEIVE_TRANSFER_FINISHED_EVENT",
      async (data: ReceiveTransferFinishedEventData) => {
        console.log("indexerB received transfer: ", data);
        await indexerB.transfer({
          amount: data.amount,
          recipient: data.sender,
        });
      },
    );

    await gateway.transfer({ amount: "1", recipient: indexerA.publicIdentifier });
    await gateway.transfer({ amount: "1", recipient: indexerB.publicIdentifier });
  });
});
