import { IConnextClient, EventNames } from "@connext/types";
import { constants } from "ethers";

import {
  ETH_AMOUNT_SM,
  createClient,
  ethProviderUrl,
  ethProviderUrlForChain,
  expect,
  fundChannel,
  getTestLoggers,
} from "./util";

const { AddressZero, Zero } = constants;

const name = "Multichain Clients";
const { timeElapsed } = getTestLoggers(name);
describe(name, () => {
  let start: number;

  let clientA: IConnextClient;
  let clientB: IConnextClient;

  beforeEach(async () => {
    start = Date.now();
    clientA = await createClient({ id: "A", ethProviderUrl });
    clientB = await createClient({ id: "B", ethProviderUrl: ethProviderUrlForChain(1338) });
    timeElapsed("beforeEach complete", start);
  });

  afterEach(async () => {
    await clientA.off();
    await clientB.off();
  });

  it("clientA on chainA can deposit and transfer to clientB on chainB", async () => {
    const transfer = { amount: ETH_AMOUNT_SM, assetId: AddressZero };
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
