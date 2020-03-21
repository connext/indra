import {
  IConnextClient,
  ReceiveTransferFinishedEventData,
  RECEIVE_TRANSFER_FAILED_EVENT,
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
    clientA = await createClient();
    clientB = await createClient();
    clientC = await createClient();
    clientD = await createClient();
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
      await fundChannel(clientA, bigNumberify(5));
      await fundChannel(clientB, bigNumberify(5));
      await fundChannel(clientC, bigNumberify(5));
      let transferCount = 0;
      clientA.on(
        "RECEIVE_TRANSFER_FINISHED_EVENT",
        async (data: ReceiveTransferFinishedEventData) => {
          console.log("CLIENTA RECEIVED TRANSFER, data: ", data);
          transferCount += 1;
          if (transferCount === 2) {
            expect(transferCount).to.eq(2);
            res();
          }
        },
      );

      clientA.on(RECEIVE_TRANSFER_FAILED_EVENT, () =>
        rej(`Received transfer failed event on clientA`),
      );
      clientB.on(RECEIVE_TRANSFER_FAILED_EVENT, () =>
        rej(`Received transfer failed event on clientA`),
      );
      clientC.on(RECEIVE_TRANSFER_FAILED_EVENT, () =>
        rej(`Received transfer failed event on clientA`),
      );
      await Promise.all([
        clientB.transfer({ amount: "1", recipient: clientA.publicIdentifier }),
        clientC.transfer({ amount: "1", recipient: clientA.publicIdentifier }),
      ]);
    });
  });
});
