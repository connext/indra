import {
  IConnextClient,
  EventPayloads,
  EventNames,
} from "@connext/types";
import { AddressZero } from "ethers/constants";
import { Client } from "ts-nats";
import { before } from "mocha";

import {
  createClient,
  ETH_AMOUNT_SM,
  fundChannel,
  requestCollateral,
  TOKEN_AMOUNT_SM,
  expect,
} from "../util";
import { asyncTransferAsset } from "../util/helpers/asyncTransferAsset";
import { getNatsClient } from "../util/nats";
import { bigNumberify } from "ethers/utils";

describe("Full Flow: Transfer", () => {
  let clientA: IConnextClient;
  let clientB: IConnextClient;
  let clientC: IConnextClient;
  let clientD: IConnextClient;
  let tokenAddress: string;
  let nats: Client;

  before(async () => {
    nats = getNatsClient();
  });

  beforeEach(async () => {
    clientA = await createClient({ id: "A" });
    clientB = await createClient({ id: "B" });
    clientC = await createClient({ id: "C" });
    clientD = await createClient({ id: "D" });
    tokenAddress = clientA.config.contractAddresses.Token;
  });

  afterEach(async () => {
    await clientA.messaging.disconnect();
    await clientB.messaging.disconnect();
    await clientC.messaging.disconnect();
    await clientD.messaging.disconnect();
  });

  it("User transfers ETH to multiple clients", async () => {
    await fundChannel(clientA, ETH_AMOUNT_SM.mul(4), AddressZero);
    await requestCollateral(clientB, AddressZero);
    await requestCollateral(clientC, AddressZero);
    await requestCollateral(clientD, AddressZero);
    await asyncTransferAsset(clientA, clientB, ETH_AMOUNT_SM, AddressZero, nats);
    await asyncTransferAsset(clientA, clientC, ETH_AMOUNT_SM, AddressZero, nats);
    await asyncTransferAsset(clientA, clientD, ETH_AMOUNT_SM, AddressZero, nats);
  });

  it("User transfers tokens to multiple clients", async () => {
    await fundChannel(clientA, TOKEN_AMOUNT_SM.mul(4), tokenAddress);
    await requestCollateral(clientB, tokenAddress);
    await requestCollateral(clientC, tokenAddress);
    await requestCollateral(clientD, tokenAddress);
    await asyncTransferAsset(clientA, clientB, TOKEN_AMOUNT_SM, tokenAddress, nats);
    await asyncTransferAsset(clientA, clientC, TOKEN_AMOUNT_SM, tokenAddress, nats);
    await asyncTransferAsset(clientA, clientD, TOKEN_AMOUNT_SM, tokenAddress, nats);
  });

  it("User receives multiple ETH transfers ", async () => {
    await fundChannel(clientB, ETH_AMOUNT_SM, AddressZero);
    await fundChannel(clientC, ETH_AMOUNT_SM, AddressZero);
    await fundChannel(clientD, ETH_AMOUNT_SM, AddressZero);
    await requestCollateral(clientA, AddressZero);
    await asyncTransferAsset(clientB, clientA, ETH_AMOUNT_SM, AddressZero, nats);
    await asyncTransferAsset(clientC, clientA, ETH_AMOUNT_SM, AddressZero, nats);
    await asyncTransferAsset(clientD, clientA, ETH_AMOUNT_SM, AddressZero, nats);
  });

  it("User receives multiple token transfers ", async () => {
    await fundChannel(clientB, TOKEN_AMOUNT_SM, tokenAddress);
    await fundChannel(clientC, TOKEN_AMOUNT_SM, tokenAddress);
    await fundChannel(clientD, TOKEN_AMOUNT_SM, tokenAddress);
    await requestCollateral(clientA, tokenAddress);
    await asyncTransferAsset(clientB, clientA, TOKEN_AMOUNT_SM, tokenAddress, nats);
    await asyncTransferAsset(clientC, clientA, TOKEN_AMOUNT_SM, tokenAddress, nats);
    await asyncTransferAsset(clientD, clientA, TOKEN_AMOUNT_SM, tokenAddress, nats);
  });

  it("Client receives transfers concurrently", () => {
    return new Promise(async (res, rej) => {
      // TODO: should work without collateral as well
      // seems there is a condition --> receiver sends resolve req.
      // while user has deposit in flight and node has insufficient
      // collateral. node will not allow the resolution of that payment
      await requestCollateral(clientA, AddressZero, true);
      await fundChannel(clientB, bigNumberify(5));
      await fundChannel(clientC, bigNumberify(5));
      let transferCount = 0;
      clientA.on(
        "RECEIVE_TRANSFER_FINISHED_EVENT",
        async (data: EventPayloads.ReceiveTransferFinished) => {
          transferCount += 1;
          if (transferCount === 2) {
            expect(transferCount).to.eq(2);
            res();
          }
        },
      );

      clientA.on(EventNames.RECEIVE_TRANSFER_FAILED_EVENT, () =>
        rej(`Received transfer failed event on clientA`),
      );
      clientB.on(EventNames.RECEIVE_TRANSFER_FAILED_EVENT, () =>
        rej(`Received transfer failed event on clientB`),
      );
      clientC.on(EventNames.RECEIVE_TRANSFER_FAILED_EVENT, () =>
        rej(`Received transfer failed event on clientC`),
      );
      await Promise.all([
        clientB.transfer({ amount: "1", assetId: AddressZero, recipient: clientA.publicIdentifier }),
        clientC.transfer({ amount: "1", assetId: AddressZero, recipient: clientA.publicIdentifier }),
      ]);
    });
  });
});
