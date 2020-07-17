import { IConnextClient, EventNames } from "@connext/types";
import { constants } from "ethers";

import {
  AssetOptions,
  createClient,
  ETH_AMOUNT_SM,
  ethProviderUrl,
  fundChannel,
  ethProviderUrlForChain,
} from "../util";
import { expect } from "../util";

const { AddressZero, Zero } = constants;

describe("Multichain clients", () => {
  let clientA: IConnextClient;
  let clientB: IConnextClient;

  beforeEach(async () => {
    clientA = await createClient({ id: "A", ethProviderUrl });
    clientB = await createClient({ id: "B", ethProviderUrl: ethProviderUrlForChain(1338) });
  });

  afterEach(async () => {
    await clientA.messaging.disconnect();
    await clientB.messaging.disconnect();
  });

  it("happy case: clientA on chainA can deposit and transfer to clientB on chainB", async () => {
    const transfer: AssetOptions = { amount: ETH_AMOUNT_SM, assetId: AddressZero };
    await fundChannel(clientA, transfer.amount, transfer.assetId);
    const receiverUnlock = clientB.waitFor(EventNames.CONDITIONAL_TRANSFER_UNLOCKED_EVENT, 10_000);
    const senderUnlock = clientA.waitFor(EventNames.CONDITIONAL_TRANSFER_UNLOCKED_EVENT, 10_000);
    await clientA.transfer({
      amount: transfer.amount,
      assetId: transfer.assetId,
      meta: { receiverAssetId: transfer.assetId, receiverChainId: 1338 },
      recipient: clientB.publicIdentifier,
    });
    await Promise.all([receiverUnlock, senderUnlock]);

    const freeBalanceA = await clientA.getFreeBalance(transfer.assetId);
    expect(freeBalanceA[clientA.signerAddress]).to.be.eq(Zero);

    const freeBalanceB = await clientB.getFreeBalance(transfer.assetId);
    expect(freeBalanceB[clientB.signerAddress]).to.be.eq(transfer.amount);
  });
});
