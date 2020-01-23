import { IConnextClient, LINKED_TRANSFER, LINKED_TRANSFER_TO_RECIPIENT } from "@connext/types";
import { AddressZero, One } from "ethers/constants";
import { hexlify, randomBytes } from "ethers/utils";

import { expect } from "../util";
import { AssetOptions, createClient, fundChannel } from "../util";

describe("Async Transfers", () => {
  let clientA: IConnextClient;

  beforeEach(async () => {
    clientA = await createClient();
  });

  it.skip("happy case: get linked transfer by payment id", async () => {
    const paymentId = hexlify(randomBytes(32));
    const preImage = hexlify(randomBytes(32));
    const transfer: AssetOptions = { amount: One, assetId: AddressZero };
    await fundChannel(clientA, transfer.amount, transfer.assetId);

    await clientA.conditionalTransfer({
      amount: transfer.amount.toString(),
      assetId: AddressZero,
      conditionType: LINKED_TRANSFER,
      paymentId,
      preImage,
    });
    const linkedTransfer = await clientA.getLinkedTransfer(paymentId);

    // TODO: fix race condition, the following assertion randomly fails
    expect(linkedTransfer).to.be.ok;

    expect(linkedTransfer).to.deep.include({
      amount: transfer.amount.toString(),
      assetId: AddressZero,
      paymentId,
      receiverPublicIdentifier: null,
      senderPublicIdentifier: clientA.publicIdentifier,
    });
  });

  it("happy case: get linked transfer to recipient by payment id", async () => {
    const clientB = await createClient();
    const paymentId = hexlify(randomBytes(32));
    const preImage = hexlify(randomBytes(32));
    const transfer: AssetOptions = { amount: One, assetId: AddressZero };
    await fundChannel(clientA, transfer.amount, transfer.assetId);

    await clientA.conditionalTransfer({
      amount: transfer.amount.toString(),
      assetId: AddressZero,
      conditionType: LINKED_TRANSFER_TO_RECIPIENT,
      paymentId,
      preImage,
      recipient: clientB.publicIdentifier,
    });
    const linkedTransfer = await clientA.getLinkedTransfer(paymentId);
    expect(linkedTransfer).to.deep.include({
      amount: transfer.amount.toString(),
      assetId: AddressZero,
      paymentId,
      receiverPublicIdentifier: clientB.publicIdentifier,
      senderPublicIdentifier: clientA.publicIdentifier,
    });
  });

  it("cannot get linked transfer for invalid payment id", async () => {
    const clientB = await createClient();
    const paymentId = hexlify(randomBytes(32));
    const preImage = hexlify(randomBytes(32));
    const transfer: AssetOptions = { amount: One, assetId: AddressZero };
    await fundChannel(clientA, transfer.amount, transfer.assetId);

    await clientA.conditionalTransfer({
      amount: transfer.amount.toString(),
      assetId: AddressZero,
      conditionType: LINKED_TRANSFER_TO_RECIPIENT,
      paymentId,
      preImage,
      recipient: clientB.publicIdentifier,
    });
    const linkedTransfer = await clientA.getLinkedTransfer(hexlify(randomBytes(32)));
    expect(linkedTransfer).to.not.be.ok;
  });
});
