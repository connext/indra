import { IConnextClient } from "@connext/types";
import { AddressZero } from "ethers/constants";
import { hexlify, randomBytes } from "ethers/utils";

import { createClient } from "../util";

describe("Async Transfers", () => {
  let clientA: IConnextClient;

  beforeEach(async () => {
    clientA = await createClient();
  });

  test.only("happy case: get linked transfer by payment id", async () => {
    const paymentId = hexlify(randomBytes(32));
    const preImage = hexlify(randomBytes(32));
    await clientA.deposit({ amount: "1", assetId: AddressZero });
    await clientA.conditionalTransfer({
      amount: "1",
      assetId: AddressZero,
      conditionType: "LINKED_TRANSFER",
      paymentId,
      preImage,
    });
    const linkedTransfer = await clientA.getLinkedTransfer(paymentId);
    expect(linkedTransfer).toMatchObject({
      amount: "1",
      assetId: AddressZero,
      paymentId,
      receiverPublicIdentifier: null,
      senderPublicIdentifier: clientA.publicIdentifier,
    });
  });
});
