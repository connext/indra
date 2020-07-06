import { ConditionalTransferTypes, IConnextClient, EventNames, PublicParams } from "@connext/types";
import { constants } from "ethers";

import { AssetOptions, createClient, ETH_AMOUNT_SM, fundChannel, env } from "../util";
import { expect } from "../util";

const { AddressZero, Zero } = constants;

describe.only("Multichain clients", () => {
  let clientA: IConnextClient;
  let clientB: IConnextClient;

  beforeEach(async () => {
    clientA = await createClient({ id: "A", ethProviderUrl: env.ethProviderUrl });
    console.log("created clientA on", clientA.chainId);
    clientB = await createClient({ id: "B", ethProviderUrl: env.ethProviderUrl2 });
    console.log("created clientB on", clientB.chainId);
  });

  afterEach(async () => {
    await clientA.messaging.disconnect();
    await clientB.messaging.disconnect();
  });

  it("happy case: clientA on chainA can deposit and transfer to clientB on chainB", async () => {
    const transfer: AssetOptions = { amount: ETH_AMOUNT_SM, assetId: AddressZero };
    console.log("funding clientA");
    await fundChannel(clientA, transfer.amount, transfer.assetId);
    console.log("funded");
    const receiverTransfer = clientB.waitFor(EventNames.CONDITIONAL_TRANSFER_CREATED_EVENT, 10_000);
    const senderTransfer = clientA.waitFor(EventNames.CONDITIONAL_TRANSFER_CREATED_EVENT, 10_000);
    const xfer = await clientA.transfer({
      amount: transfer.amount,
      assetId: transfer.assetId,
      meta: { receiverAssetId: transfer.assetId },
      recipient: clientB.publicIdentifier,
    });
    console.log("sent transfer");
    await receiverTransfer;
    await senderTransfer;
    console.log("transfer created, resolving");
    const { paymentId, preImage } = xfer;
    await clientB.resolveCondition({
      paymentId,
      conditionType: ConditionalTransferTypes.LinkedTransfer,
      assetId: transfer.assetId,
      preImage,
    } as PublicParams.ResolveLinkedTransfer);
    console.log("transfer resolved");

    const freeBalanceA = await clientA.getFreeBalance(transfer.assetId);
    expect(freeBalanceA[clientA.signerAddress]).to.be.eq(Zero);

    const freeBalanceB = await clientB.getFreeBalance(transfer.assetId);
    expect(freeBalanceB[clientB.signerAddress]).to.be.eq(transfer.amount);
  });
});
