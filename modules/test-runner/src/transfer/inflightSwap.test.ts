import { IConnextClient, EventNames } from "@connext/types";
import { constants } from "ethers";

import {
  createClient,
  ETH_AMOUNT_SM,
  expect,
  fundChannel,
  getTestLoggers,
  requestCollateral,
} from "../util";

const { AddressZero } = constants;

const name = "Inflight Swaps";
const { timeElapsed } = getTestLoggers(name);
describe(name, () => {
  let clientA: IConnextClient;
  let clientB: IConnextClient;
  let start: number;
  let tokenAddress: string;

  beforeEach(async () => {
    start = Date.now();
    clientA = await createClient({ id: "A" });
    clientB = await createClient({ id: "B" });
    tokenAddress = clientA.config.contractAddresses[clientA.chainId].Token!;
    timeElapsed("beforeEach complete", start);
  });

  afterEach(async () => {
    await clientA.off();
    await clientB.off();
  });

  it("client A transfers eth to client B through node with an inflight swap", async () => {
    const transfer = { amount: ETH_AMOUNT_SM, assetId: AddressZero };
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
