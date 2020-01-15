import { IConnextClient } from "@connext/types";
import { Zero } from "ethers/constants";
import { BigNumber } from "ethers/utils";

import { expect } from "../assertions";
import { ExistingBalancesAsyncTransfer } from "../types";

// NOTE: will fail if not collateralized by transfer amount exactly
// when pretransfer balances are not supplied.
export async function asyncTransferAsset(
  clientA: IConnextClient,
  clientB: IConnextClient,
  transferAmount: BigNumber,
  assetId: string,
  nodeFreeBalanceAddress: string,
  preExistingBalances: Partial<ExistingBalancesAsyncTransfer> = {},
): Promise<ExistingBalancesAsyncTransfer> {
  const preTransfer: ExistingBalancesAsyncTransfer = {
    freeBalanceClientA: transferAmount,
    freeBalanceNodeA: Zero,
    freeBalanceClientB: Zero,
    freeBalanceNodeB: transferAmount,
    ...preExistingBalances,
  };

  const {
    [clientA.freeBalanceAddress]: preTransferFreeBalanceClientA,
    [nodeFreeBalanceAddress]: preTransferFreeBalanceNodeA,
  } = await clientA.getFreeBalance(assetId);
  expect(preTransferFreeBalanceClientA).to.be.bigNumberEq(preTransfer.freeBalanceClientA);
  expect(preTransferFreeBalanceNodeA).to.be.bigNumberEq(preTransfer.freeBalanceNodeA);

  const {
    [clientB.freeBalanceAddress]: preTransferFreeBalanceClientB,
    [nodeFreeBalanceAddress]: preTransferFreeBalanceNodeB,
  } = await clientB.getFreeBalance(assetId);
  expect(preTransferFreeBalanceClientB).to.be.bigNumberEq(preTransfer.freeBalanceClientB);
  expect(preTransferFreeBalanceNodeB).to.be.bigNumberEq(preTransfer.freeBalanceNodeB);

  let paymentId;
  await new Promise(async resolve => {
    let count = 0;
    clientA.once("UNINSTALL_EVENT", async () => {
      count += 1;
      if (count === 2) {
        resolve();
      }
    });

    clientB.once("RECIEVE_TRANSFER_FINISHED_EVENT", async () => {
      count += 1;
      if (count === 2) {
        resolve();
      }
    });

    const { paymentId: senderPaymentId } = await clientA.transfer({
      amount: transferAmount.toString(),
      assetId,
      meta: { hello: "world" },
      recipient: clientB.publicIdentifier,
    });
    paymentId = senderPaymentId;
  });
  expect((await clientB.getAppInstances()).length).to.be.eq(Zero.toNumber());
  expect((await clientA.getAppInstances()).length).to.be.eq(Zero.toNumber());

  const {
    [clientA.freeBalanceAddress]: postTransferFreeBalanceClientA,
    [nodeFreeBalanceAddress]: postTransferFreeBalanceNodeA,
  } = await clientA.getFreeBalance(assetId);
  expect(postTransferFreeBalanceClientA).to.be.bigNumberEq(
    preTransferFreeBalanceClientA.sub(transferAmount),
  );
  expect(postTransferFreeBalanceNodeA).to.be.bigNumberEq(
    preTransferFreeBalanceNodeA.add(transferAmount),
  );

  const {
    [clientB.freeBalanceAddress]: postTransferFreeBalanceClientB,
    [nodeFreeBalanceAddress]: postTransferFreeBalanceNodeB,
  } = await clientB.getFreeBalance(assetId);
  expect(postTransferFreeBalanceClientB).to.be.bigNumberEq(
    preTransferFreeBalanceClientB.add(transferAmount),
  );
  expect(postTransferFreeBalanceNodeB).to.be.bigNumberEq(
    preTransferFreeBalanceNodeB.sub(transferAmount),
  );

  // TODO: explicitly await for status redeemed -> reclaimed
  await new Promise(res => setTimeout(res, 1000));

  const paymentA = await clientA.getLinkedTransfer(paymentId);
  const paymentB = await clientB.getLinkedTransfer(paymentId);
  expect(paymentA).to.deep.include({
    amount: transferAmount.toString(),
    assetId,
    meta: { hello: "world" },
    paymentId,
    receiverPublicIdentifier: clientB.publicIdentifier,
    senderPublicIdentifier: clientA.publicIdentifier,
    status: "RECLAIMED",
    type: "LINKED",
  });
  expect(paymentA).to.deep.include(paymentB);

  const postTransfer: ExistingBalancesAsyncTransfer = {
    freeBalanceClientA: postTransferFreeBalanceClientA,
    freeBalanceNodeA: postTransferFreeBalanceNodeA,
    // tslint:disable-next-line:object-literal-sort-keys
    freeBalanceClientB: postTransferFreeBalanceClientB,
    freeBalanceNodeB: postTransferFreeBalanceNodeB,
  };

  return postTransfer;
}
