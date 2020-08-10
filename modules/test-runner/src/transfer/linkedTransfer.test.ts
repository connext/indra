import { IConnextClient, ConditionalTransferTypes, EventNames } from "@connext/types";
import { getRandomBytes32, getRandomChannelSigner } from "@connext/utils";
import { constants } from "ethers";

import { AssetOptions, createClient, expect, fundChannel } from "../util";

const { AddressZero, One, Two } = constants;

describe("Linked Transfer", () => {
  let clientA: IConnextClient;
  let clientB: IConnextClient;

  beforeEach(async () => {
    clientA = await createClient({ id: "A" });
    clientB = await createClient({ id: "B" });
  });

  afterEach(async () => {
    await clientA.messaging.disconnect();
    await clientB.messaging.disconnect();
  });

  it("happy case: a user can redeem their own link payment", async () => {
    const transfer: AssetOptions = { amount: One, assetId: AddressZero };
    await fundChannel(clientA, transfer.amount, transfer.assetId);
    const balBefore = (await clientA.getFreeBalance(transfer.assetId))[clientA.signerAddress];
    const linkedTransfer = await clientA.conditionalTransfer({
      amount: transfer.amount.toString(),
      assetId: AddressZero,
      conditionType: ConditionalTransferTypes.LinkedTransfer,
      paymentId: getRandomBytes32(),
      preImage: getRandomBytes32(),
    });
    const balMiddle = (await clientA.getFreeBalance(transfer.assetId))[clientA.signerAddress];
    expect(balBefore.sub(transfer.amount)).to.be.equal(balMiddle);
    await clientA.resolveCondition({
      conditionType: ConditionalTransferTypes.LinkedTransfer,
      paymentId: linkedTransfer.paymentId,
      preImage: linkedTransfer.preImage!,
    });
    const balAfter = (await clientA.getFreeBalance(transfer.assetId))[clientA.signerAddress];
    expect(balBefore).to.be.equal(balAfter);
  });

  it("happy case: a user can redeem someone else's link payment", async () => {
    const transfer: AssetOptions = { amount: One, assetId: AddressZero };
    await fundChannel(clientA, transfer.amount, transfer.assetId);
    const balBefore = (await clientA.getFreeBalance(transfer.assetId))[clientA.signerAddress];
    const linkedTransfer = await clientA.conditionalTransfer({
      amount: transfer.amount.toString(),
      assetId: AddressZero,
      conditionType: ConditionalTransferTypes.LinkedTransfer,
      paymentId: getRandomBytes32(),
      preImage: getRandomBytes32(),
    });
    const balMiddle = (await clientA.getFreeBalance(transfer.assetId))[clientA.signerAddress];
    expect(balBefore.sub(transfer.amount).toString()).to.be.equal(balMiddle.toString());
    await clientB.resolveCondition({
      conditionType: ConditionalTransferTypes.LinkedTransfer,
      paymentId: linkedTransfer.paymentId,
      preImage: linkedTransfer.preImage!,
    });
    const balAfter = (await clientB.getFreeBalance(transfer.assetId))[clientB.signerAddress];
    expect(transfer.amount.toString()).to.be.equal(balAfter.toString());
  });

  it("happy case: linked transfers can be sent to an offline recipient", async () => {
    const transfer: AssetOptions = { amount: One, assetId: AddressZero };
    await fundChannel(clientA, transfer.amount, transfer.assetId);
    const balBefore = (await clientA.getFreeBalance(transfer.assetId))[clientA.signerAddress];
    const offlineSigner = getRandomChannelSigner();
    await clientA.conditionalTransfer({
      amount: transfer.amount.toString(),
      assetId: AddressZero,
      conditionType: ConditionalTransferTypes.LinkedTransfer,
      paymentId: getRandomBytes32(),
      preImage: getRandomBytes32(),
      recipient: offlineSigner.publicIdentifier,
    });
    const balMiddle = (await clientA.getFreeBalance(transfer.assetId))[clientA.signerAddress];
    expect(balBefore.sub(transfer.amount).toString()).to.be.equal(balMiddle.toString());
    const recipient = await createClient({ id: "O", signer: offlineSigner });
    // The pending transfer will be resolved during connect, no need to resolve it manually
    const balAfter = (await recipient.getFreeBalance(transfer.assetId))[recipient.signerAddress];
    expect(transfer.amount.toString()).to.be.equal(balAfter.toString());
  });

  it("happy case: linked transfers can require the recipient be online", async () => {
    const transfer: AssetOptions = { amount: One, assetId: AddressZero };
    await fundChannel(clientA, Two, transfer.assetId);
    const balBefore = (await clientA.getFreeBalance(transfer.assetId))[clientA.signerAddress];
    // Transfer to online client succeeds
    const linkedTransfer = await clientA.conditionalTransfer({
      amount: transfer.amount.toString(),
      assetId: AddressZero,
      conditionType: ConditionalTransferTypes.LinkedTransfer,
      paymentId: getRandomBytes32(),
      preImage: getRandomBytes32(),
      recipient: clientB.publicIdentifier,
      requireOnline: true,
    });
    expect(balBefore.sub(transfer.amount).toString()).to.be.equal(
      (await clientA.getFreeBalance(transfer.assetId))[clientA.signerAddress].toString(),
    );
    // this resolve will return early & the unlock will need to be waited on explicitly (y tho..?)
    await clientB.resolveCondition({
      conditionType: ConditionalTransferTypes.LinkedTransfer,
      paymentId: linkedTransfer.paymentId,
      preImage: linkedTransfer.preImage!,
    });
    await clientB.waitFor(EventNames.UNINSTALL_EVENT, 10_000);
    expect(transfer.amount.toString()).to.be.equal(
      (await clientB.getFreeBalance(transfer.assetId))[clientB.signerAddress].toString(),
    );
    // Transfer to offline client fails
    expect(clientA.conditionalTransfer({
      amount: transfer.amount.toString(),
      assetId: AddressZero,
      conditionType: ConditionalTransferTypes.LinkedTransfer,
      paymentId: getRandomBytes32(),
      preImage: getRandomBytes32(),
      recipient: getRandomChannelSigner().publicIdentifier,
      requireOnline: true,
    })).to.be.rejected;
  });

  it("happy case: get linked transfer by payment id", async () => {
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
    expect(linkedTransfer).to.be.ok;
    expect(linkedTransfer).to.deep.include({
      amount: transfer.amount,
      assetId: AddressZero,
      paymentId,
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
