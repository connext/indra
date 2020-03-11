/* global before */
import { IConnextClient } from "@connext/types";
import { AddressZero } from "ethers/constants";
import { Client } from "ts-nats";

import {
  createClient,
  ETH_AMOUNT_SM,
  fundChannel,
  requestCollateral,
  TOKEN_AMOUNT_SM,
} from "../util";
import { asyncTransferAsset } from "../util/helpers/asyncTransferAsset";
import { connectNats, closeNats } from "../util/nats";
import { after } from "mocha";

describe("Full Flow: Transfer", () => {
  let clientA: IConnextClient;
  let clientB: IConnextClient;
  let clientC: IConnextClient;
  let clientD: IConnextClient;
  let tokenAddress: string;
  let nats: Client;

  before(async () => {
    nats = await connectNats();
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

  after(() => {
    closeNats();
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
});
