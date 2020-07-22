import { IConnextClient, EventNames } from "@connext/types";
import { constants } from "ethers";

import { AssetOptions, createClient, ETH_AMOUNT_SM, fundChannel, requestCollateral } from "../util";
import { expect } from "../util";

const { AddressZero } = constants;

describe("Inflight swap", () => {
  let clientA: IConnextClient;
  let clientB: IConnextClient;
  let tokenAddress: string;

  beforeEach(async () => {
    clientA = await createClient({ id: "A" });
    clientB = await createClient({ id: "B" });
    tokenAddress = clientA.config.contractAddresses[clientA.chainId].Token!;
  });

  afterEach(async () => {
    await clientA.messaging.disconnect();
    await clientB.messaging.disconnect();
  });

  it("happy case: client A transfers eth to client B through node with an inflight swap", async () => {
    const transfer: AssetOptions = { amount: ETH_AMOUNT_SM, assetId: AddressZero };
    await fundChannel(clientA, transfer.amount, transfer.assetId);
    await requestCollateral(clientB, transfer.assetId);
    const receiverTransfer = clientB.waitFor(
      EventNames.CONDITIONAL_TRANSFER_UNLOCKED_EVENT,
      10_000,
    );
    const senderTransfer = clientA.waitFor(EventNames.CONDITIONAL_TRANSFER_UNLOCKED_EVENT, 10_000);
    await clientA.transfer({
      amount: transfer.amount,
      assetId: transfer.assetId,
      meta: { receiverAssetId: tokenAddress },
      recipient: clientB.publicIdentifier,
    });
    await receiverTransfer;
    await senderTransfer;

    const freeBalanceToken = await clientB.getFreeBalance(tokenAddress);
    expect(freeBalanceToken[clientB.signerAddress]).to.be.gt(0);

    const freeBalanceEth = await clientB.getFreeBalance(AddressZero);
    expect(freeBalanceEth[clientB.signerAddress]).to.be.eq(0);
  });
});
