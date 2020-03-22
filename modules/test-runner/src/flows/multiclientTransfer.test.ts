import {
  IConnextClient,
  ReceiveTransferFinishedEventData,
  EventNames,
  toBN,
} from "@connext/types";
import { AddressZero } from "ethers/constants";
import { bigNumberify } from "ethers/utils";

import { expect, createClient, fundChannel } from "../util";

// TODO: fix race conditions
describe.skip("Full Flow: Multi-client transfer", () => {
  let gateway: IConnextClient;
  let indexerA: IConnextClient;
  let indexerB: IConnextClient;

  beforeEach(async () => {
    gateway = await createClient();
    indexerA = await createClient();
    indexerB = await createClient();
  });

  afterEach(async () => {
    await gateway.messaging.disconnect();
    await indexerA.messaging.disconnect();
    await indexerB.messaging.disconnect();
  });

  it("Clients transfer assets between themselves", async function() {
    // how long the ping-pong transfers should last in s
    const DURATION = 30_000;
    let gatewayTransfers = {
      sent: 0,
      received: 0,
    };
    let indexerATransfers = {
      sent: 0,
      received: 0,
    };
    let indexerBTransfers = {
      sent: 0,
      received: 0,
    };
    const startTime = Date.now();
    await new Promise(async (res, rej) => {
      await fundChannel(gateway, bigNumberify(100));
      gateway.on(
        "RECEIVE_TRANSFER_FINISHED_EVENT",
        async (data: ReceiveTransferFinishedEventData<any>) => {
          const freeBalance = await gateway.getFreeBalance();
          if (freeBalance[gateway.freeBalanceAddress].isZero()) {
            res();
          }
          if (Date.now() - startTime >= DURATION) {
            // sufficient time has elapsed, resolve
            res();
          }
          gatewayTransfers.received += 1;
          await gateway.transfer({
            amount: data.amount,
            assetId: AddressZero,
            recipient: data.sender,
          });
          if (data.sender === indexerA.publicIdentifier) {
            indexerATransfers.sent += 1;
          } else if (data.sender === indexerB.publicIdentifier) {
            indexerBTransfers.sent += 1;
          } else {
            throw new Error(`Unexpected sender: ${data.sender}`);
          }
        },
      );

      indexerA.on(
        "RECEIVE_TRANSFER_FINISHED_EVENT",
        async (data: ReceiveTransferFinishedEventData<any>) => {
          indexerATransfers.received += 1;
          await indexerA.transfer({
            amount: data.amount,
            assetId: AddressZero,
            recipient: data.sender,
          });
          expect(data.sender).to.be.equal(gateway.publicIdentifier);
          gatewayTransfers.sent += 1;
        },
      );

      indexerB.on(
        "RECEIVE_TRANSFER_FINISHED_EVENT",
        async (data: ReceiveTransferFinishedEventData<any>) => {
          indexerBTransfers.received += 1;
          await indexerB.transfer({
            amount: data.amount,
            assetId: AddressZero,
            recipient: data.sender,
          });
          expect(data.sender).to.be.equal(gateway.publicIdentifier);
          gatewayTransfers.sent += 1;
        },
      );

      // register failure events
      const rejectIfFailed = (object: IConnextClient) => {
        object.on(EventNames.RECEIVE_TRANSFER_FAILED_EVENT, () =>
          rej(`Received transfer failed event from ${object.publicIdentifier}`),
        );
      };
      rejectIfFailed(indexerA);
      rejectIfFailed(indexerB);
      rejectIfFailed(gateway);

      await gateway.transfer({ amount: toBN("1"), recipient: indexerA.publicIdentifier, assetId: AddressZero });
      await gateway.transfer({ amount: toBN("1"), recipient: indexerB.publicIdentifier, assetId: AddressZero });
    });
    expect(gatewayTransfers.received).to.be.gt(0);
    expect(gatewayTransfers.sent).to.be.gt(0);
    expect(indexerATransfers.sent).to.be.gt(0);
    expect(indexerATransfers.received).to.be.gt(0);
    expect(indexerBTransfers.sent).to.be.gt(0);
    expect(indexerBTransfers.received).to.be.gt(0);
  });
});
