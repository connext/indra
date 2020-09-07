import { IConnextClient, ConditionalTransferTypes, EventNames } from "@connext/types";
import { getRandomBytes32, getRandomChannelSigner, delay } from "@connext/utils";
import { constants } from "ethers";

import { createClient, expect, fundChannel, getTestLoggers } from "../util";

const { AddressZero, One, Two } = constants;

const name = "Linked Transfers";
const { timeElapsed } = getTestLoggers(name);
describe(name, () => {
  let clientA: IConnextClient;
  let clientB: IConnextClient;
  let start: number;

  beforeEach(async () => {
    start = Date.now();
    clientA = await createClient({ id: "A" });
    clientB = await createClient({ id: "B" });
    timeElapsed("beforeEach complete", start);
  });

  afterEach(async () => {
    await clientA.off();
    await clientB.off();
  });

  it("a user can redeem their own link payment", async () => {
    const transfer = { amount: One, assetId: AddressZero };
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

  it("a user can redeem someone else's link payment", async () => {
    const transfer = { amount: One, assetId: AddressZero };
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

  it("linked transfers can be sent to an offline recipient without a channel", async () => {
    const transfer = { amount: One, assetId: AddressZero };
    await fundChannel(clientA, transfer.amount, transfer.assetId);
    const balBefore = (await clientA.getFreeBalance(transfer.assetId))[clientA.signerAddress];
    const offlineSigner = getRandomChannelSigner();
    let recipient = await createClient({ id: "O", signer: offlineSigner });
    await recipient.messaging.disconnect();
    recipient.off();
    await delay(10_000);
    await clientA.conditionalTransfer({
      amount: transfer.amount.toString(),
      assetId: AddressZero,
      conditionType: ConditionalTransferTypes.LinkedTransfer,
      paymentId: getRandomBytes32(),
      preImage: getRandomBytes32(),
      recipient: recipient.publicIdentifier,
    });
    const balMiddle = (await clientA.getFreeBalance(transfer.assetId))[clientA.signerAddress];
    expect(balBefore.sub(transfer.amount).toString()).to.be.equal(balMiddle.toString());
    await delay(90_000);
    recipient = await createClient({ id: "O", signer: offlineSigner });
    // The pending transfer will be resolved during connect, no need to resolve it manually
    const balAfter = (await recipient.getFreeBalance(transfer.assetId))[recipient.signerAddress];
    expect(transfer.amount.toString()).to.be.equal(balAfter.toString());
  });

  it("linked transfers can be sent to a recipient", async () => {
    const transfer = { amount: One, assetId: AddressZero };
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

  it("linked transfers can require the recipient be online", async () => {
    const transfer = { amount: One, assetId: AddressZero };
    await fundChannel(clientA, Two, transfer.assetId);
    const balBefore = (await clientA.getFreeBalance(transfer.assetId))[clientA.signerAddress];
    // Transfer to online client succeeds
    const linkedTransfer = await clientA.conditionalTransfer({
      amount: transfer.amount.toString(),
      assetId: AddressZero,
      conditionType: ConditionalTransferTypes.OnlineTransfer,
      paymentId: getRandomBytes32(),
      preImage: getRandomBytes32(),
      recipient: clientB.publicIdentifier,
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
    expect(
      clientA.conditionalTransfer({
        amount: transfer.amount.toString(),
        assetId: AddressZero,
        conditionType: ConditionalTransferTypes.OnlineTransfer,
        paymentId: getRandomBytes32(),
        preImage: getRandomBytes32(),
        recipient: getRandomChannelSigner().publicIdentifier,
      }),
    ).to.be.rejected;
  });

  it("get linked transfer by payment id", async () => {
    const paymentId = getRandomBytes32();
    const preImage = getRandomBytes32();
    const transfer = { amount: One, assetId: AddressZero };
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

  it("get linked transfer to recipient by payment id", async () => {
    const clientB = await createClient();
    const paymentId = getRandomBytes32();
    const preImage = getRandomBytes32();
    const transfer = { amount: One, assetId: AddressZero };
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
    const transfer = { amount: One, assetId: AddressZero };
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
