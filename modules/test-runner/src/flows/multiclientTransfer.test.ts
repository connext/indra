import { IConnextClient, ReceiveTransferFinishedEventData } from "@connext/types";
import { Client } from "ts-nats";
import { before, after } from "mocha";
import { parseEther, bigNumberify } from "ethers/utils";

import { env, Logger, createClient, fundChannel, connectNats, closeNats } from "../util";

describe("Full Flow: Multi-client transfer", () => {
  let log = new Logger("MultiClientTransfer", env.logLevel);
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
  });

  after(() => {
    closeNats();
  });

  it.skip("Clients transfer assets between themselves", async function() {
    this.timeout(300_000);
    return new Promise(async res => {
      await fundChannel(gateway, bigNumberify(100));
      gateway.on(
        "RECEIVE_TRANSFER_FINISHED_EVENT",
        async (data: ReceiveTransferFinishedEventData) => {
          const freeBalance = await gateway.getFreeBalance();
          if (freeBalance[gateway.freeBalanceAddress].isZero()) {
            res();
          }
          log.info(`gateway received transfer: ${JSON.stringify(data)}`);
          await gateway.transfer({
            amount: data.amount,
            recipient: data.sender,
          });
        },
      );

      indexerA.on(
        "RECEIVE_TRANSFER_FINISHED_EVENT",
        async (data: ReceiveTransferFinishedEventData) => {
          log.info(`indexerA received transfer: ${JSON.stringify(data)}`);
          await indexerA.transfer({
            amount: data.amount,
            recipient: data.sender,
          });
        },
      );

      indexerB.on(
        "RECEIVE_TRANSFER_FINISHED_EVENT",
        async (data: ReceiveTransferFinishedEventData) => {
          log.info(`indexerB received transfer: ${JSON.stringify(data)}`);
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
});
