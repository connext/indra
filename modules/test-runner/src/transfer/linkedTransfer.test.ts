import { IConnextClient, ConditionalTransferTypes, PublicResults } from "@connext/types";
import { getRandomBytes32 } from "@connext/utils";
import { AddressZero, One } from "ethers/constants";

import { expect } from "../util";
import { AssetOptions, createClient, fundChannel } from "../util";

describe("Linked Transfer", () => {
  let clientA: IConnextClient;

  beforeEach(async () => {
    clientA = await createClient();
  });

  afterEach(async () => {
    await clientA.messaging.disconnect();
  });

  // un-skip this once issue 1145 is fixed
  it.skip("happy case: a user can redeem their own link payment", async () => {
    const transfer: AssetOptions = { amount: One, assetId: AddressZero };
    await fundChannel(clientA, transfer.amount, transfer.assetId);
    const linkedTransfer = (await clientA.conditionalTransfer({
      amount: transfer.amount.toString(),
      assetId: AddressZero,
      conditionType: ConditionalTransferTypes.LinkedTransfer,
      paymentId: getRandomBytes32(),
      preImage: getRandomBytes32(),
    })) as PublicResults.LinkedTransfer;
    const res = await clientA.resolveCondition({
      conditionType: ConditionalTransferTypes.LinkedTransfer,
      paymentId: linkedTransfer.paymentId,
      preImage: linkedTransfer.preImage,
    });
    console.log(`Resolve result: ${JSON.stringify(res)}`);
  });

  it.skip("happy case: get linked transfer by payment id", async () => {
    const paymentId = getRandomBytes32();
    const preImage = getRandomBytes32();
    const transfer: AssetOptions = { amount: One, assetId: AddressZero };
    await fundChannel(clientA, transfer.amount, transfer.assetId);

    await clientA.conditionalTransfer({
      amount: transfer.amount.toString(),
      assetId: AddressZero,
      conditionType: ConditionalTransferTypes.LinkedTransfer,
      paymentId,
      preImage,
    });
    const linkedTransfer = await clientA.getLinkedTransfer(paymentId);

    // TODO: fix race condition, the following assertion randomly fails
    expect(linkedTransfer).to.be.ok;

    expect(linkedTransfer).to.deep.include({
      amount: transfer.amount,
      assetId: AddressZero,
      paymentId,
      receiverIdentifier: null,
      senderIdentifier: clientA.publicIdentifier,
    });
  });

  it("happy case: get linked transfer to recipient by payment id", async () => {
    const clientB = await createClient();
    const paymentId = getRandomBytes32();
    const preImage = getRandomBytes32();
    const transfer: AssetOptions = { amount: One, assetId: AddressZero };
    await fundChannel(clientA, transfer.amount, transfer.assetId);
    await clientA.conditionalTransfer({
      amount: transfer.amount.toString(),
      assetId: AddressZero,
      conditionType: ConditionalTransferTypes.LinkedTransfer,
      paymentId,
      preImage,
      recipient: clientB.publicIdentifier,
    });
    const linkedTransfer = await clientA.getLinkedTransfer(paymentId);
    expect(linkedTransfer).to.deep.include({
      amount: transfer.amount,
      assetId: AddressZero,
      paymentId,
      receiverIdentifier: clientB.publicIdentifier,
      senderIdentifier: clientA.publicIdentifier,
    });
  });

  it("cannot get linked transfer for invalid payment id", async () => {
    const clientB = await createClient();
    const paymentId = getRandomBytes32();
    const preImage = getRandomBytes32();
    const transfer: AssetOptions = { amount: One, assetId: AddressZero };
    await fundChannel(clientA, transfer.amount, transfer.assetId);

    await clientA.conditionalTransfer({
      amount: transfer.amount,
      assetId: AddressZero,
      conditionType: ConditionalTransferTypes.LinkedTransfer,
      paymentId,
      preImage,
      recipient: clientB.publicIdentifier,
    });
    const linkedTransfer = await clientA.getLinkedTransfer(getRandomBytes32());
    expect(linkedTransfer).to.not.be.ok;
  });
});
