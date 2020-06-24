import { IConnextClient, EventNames } from "@connext/types";
import { toBN } from "@connext/utils";
import { BigNumber, constants } from "ethers";

import { expect, createClient, fundChannel } from "../util";

const { AddressZero } = constants;

// TODO: fix race condition
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

  it("Clients transfer assets between themselves", async function () {
    // how long the ping-pong transfers should last in s
    const DURATION = 15_000;
    const gatewayTransfers = {
      sent: 0,
      received: 0,
    };
    const indexerATransfers = {
      sent: 0,
      received: 0,
    };
    const indexerBTransfers = {
      sent: 0,
      received: 0,
    };
    const startTime = Date.now();
    await new Promise(async (res, rej) => {
      await fundChannel(gateway, BigNumber.from(100));
      gateway.on(EventNames.CONDITIONAL_TRANSFER_UNLOCKED_EVENT, async (data) => {
        gatewayTransfers.received += 1;
        const freeBalance = await gateway.getFreeBalance();
        if (freeBalance[gateway.signerAddress].isZero()) {
          res();
        }
        if (Date.now() - startTime >= DURATION) {
          // sufficient time has elapsed, resolve
          res();
        }
        await gateway.transfer({
          amount: toBN(data.amount),
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
      });

      indexerA.on(EventNames.CONDITIONAL_TRANSFER_UNLOCKED_EVENT, async (data) => {
        indexerATransfers.received += 1;
        await indexerA.transfer({
          amount: toBN(data.amount),
          assetId: AddressZero,
          recipient: data.sender,
        });
        expect(data.sender).to.be.equal(gateway.publicIdentifier);
        gatewayTransfers.sent += 1;
      });

      indexerB.on(EventNames.CONDITIONAL_TRANSFER_UNLOCKED_EVENT, async (data) => {
        indexerBTransfers.received += 1;
        await indexerB.transfer({
          amount: toBN(data.amount),
          assetId: AddressZero,
          recipient: data.sender,
        });
        expect(data.sender).to.be.equal(gateway.publicIdentifier);
        gatewayTransfers.sent += 1;
      });

      // register failure events
      const rejectIfFailed = (object: IConnextClient) => {
        object.on(EventNames.CONDITIONAL_TRANSFER_FAILED_EVENT, () =>
          rej(`Received transfer failed event from ${object.publicIdentifier}`),
        );
      };
      rejectIfFailed(indexerA);
      rejectIfFailed(indexerB);
      rejectIfFailed(gateway);

      await gateway.transfer({
        amount: toBN("1"),
        recipient: indexerA.publicIdentifier,
        assetId: AddressZero,
      });
      await gateway.transfer({
        amount: toBN("1"),
        recipient: indexerB.publicIdentifier,
        assetId: AddressZero,
      });
    });
    expect(gatewayTransfers.received).to.be.gt(0);
    expect(gatewayTransfers.sent).to.be.gt(0);
    expect(indexerATransfers.sent).to.be.gt(0);
    expect(indexerATransfers.received).to.be.gt(0);
    expect(indexerBTransfers.sent).to.be.gt(0);
    expect(indexerBTransfers.received).to.be.gt(0);
  });
});
