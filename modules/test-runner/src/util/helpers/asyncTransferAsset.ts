import { IConnextClient } from "@connext/types";
import { Zero } from "ethers/constants";
import { BigNumber } from "ethers/utils";

import { expect } from "../assertions";
import { ExistingBalancesAsyncTransfer } from "../types";

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
  expect(preTransferFreeBalanceClientA.toString()).to.be.eq(preTransfer.freeBalanceClientA.toString());
  expect(preTransferFreeBalanceNodeA.toString()).to.be.eq(preTransfer.freeBalanceNodeA.toString());

  const {
    [clientB.freeBalanceAddress]: preTransferFreeBalanceClientB,
    [nodeFreeBalanceAddress]: preTransferFreeBalanceNodeB,
  } = await clientB.getFreeBalance(assetId);
  expect(preTransferFreeBalanceClientB.toString()).to.be.eq(preTransfer.freeBalanceClientB.toString());
  expect(preTransferFreeBalanceNodeB.toString()).to.be.eq(preTransfer.freeBalanceNodeB.toString());

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
  expect(postTransferFreeBalanceClientA.toString()).to.be.eq(
    preTransferFreeBalanceClientA.sub(transferAmount).toString(),
  );
  expect(postTransferFreeBalanceNodeA.toString()).to.be.eq(
    preTransferFreeBalanceNodeA.add(transferAmount).toString(),
  );

  const {
    [clientB.freeBalanceAddress]: postTransferFreeBalanceClientB,
    [nodeFreeBalanceAddress]: postTransferFreeBalanceNodeB,
  } = await clientB.getFreeBalance(assetId);
  expect(postTransferFreeBalanceClientB.toString()).to.be.eq(preTransferFreeBalanceClientB.add(transferAmount).toString());
  expect(postTransferFreeBalanceNodeB.toString()).to.be.eq(preTransferFreeBalanceNodeB.sub(transferAmount).toString());

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
