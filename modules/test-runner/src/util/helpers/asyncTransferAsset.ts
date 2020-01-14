import { IConnextClient } from "@connext/types";
import { Zero } from "ethers/constants";
import { BigNumber } from "ethers/utils";

import { ExistingBalancesAsyncTransfer } from "../types";

export async function asyncTransferAsset(
  clientA: IConnextClient,
  clientB: IConnextClient,
  transferAmount: BigNumber,
  assetId: string,
  nodeFreeBalanceAddress: string,
): Promise<ExistingBalancesAsyncTransfer> {
  const {
    [clientA.freeBalanceAddress]: preTransferFreeBalanceClientA,
    [nodeFreeBalanceAddress]: preTransferFreeBalanceNodeA,
  } = await clientA.getFreeBalance(assetId);

  const {
    [clientB.freeBalanceAddress]: preTransferFreeBalanceClientB,
    [nodeFreeBalanceAddress]: preTransferFreeBalanceNodeB,
  } = await clientB.getFreeBalance(assetId);

  let paymentId: string;

  const transferFinished = Promise.all([
    new Promise(async resolve => {
      clientA.once("UNINSTALL_EVENT", async () => {
        resolve();
      });
    }),
    new Promise(async resolve => {
      clientB.once("RECIEVE_TRANSFER_FINISHED_EVENT", async () => {
        resolve();
      });
    }),
  ]);

  const { paymentId: senderPaymentId } = await clientA.transfer({
    amount: transferAmount.toString(),
    assetId,
    meta: { hello: "world" },
    recipient: clientB.publicIdentifier,
  });
  paymentId = senderPaymentId;

  await transferFinished;
  expect((await clientB.getAppInstances()).length).toEqual(Zero.toNumber());
  expect((await clientA.getAppInstances()).length).toEqual(Zero.toNumber());

  const {
    [clientA.freeBalanceAddress]: postTransferFreeBalanceClientA,
    [nodeFreeBalanceAddress]: postTransferFreeBalanceNodeA,
  } = await clientA.getFreeBalance(assetId);
  expect(postTransferFreeBalanceClientA).toBeBigNumberEq(
    preTransferFreeBalanceClientA.sub(transferAmount),
  );
  expect(postTransferFreeBalanceNodeA).toBeBigNumberEq(
    preTransferFreeBalanceNodeA.add(transferAmount),
  );

  const {
    [clientB.freeBalanceAddress]: postTransferFreeBalanceClientB,
    [nodeFreeBalanceAddress]: postTransferFreeBalanceNodeB,
  } = await clientB.getFreeBalance(assetId);
  expect(postTransferFreeBalanceClientB).toBeBigNumberEq(
    preTransferFreeBalanceClientB.add(transferAmount),
  );
  expect(postTransferFreeBalanceNodeB).toBeBigNumberEq(
    preTransferFreeBalanceNodeB.sub(transferAmount),
  );

  const paymentA = await clientA.getLinkedTransfer(paymentId);
  const paymentB = await clientB.getLinkedTransfer(paymentId);
  expect(paymentA).toMatchObject({
    amount: transferAmount.toString(),
    assetId,
    meta: { hello: "world" },
    paymentId,
    receiverPublicIdentifier: clientB.publicIdentifier,
    senderPublicIdentifier: clientA.publicIdentifier,
    status: "RECLAIMED",
    type: "LINKED",
  });
  expect(paymentB).toMatchObject(paymentA);

  const postTransfer: ExistingBalancesAsyncTransfer = {
    freeBalanceClientA: postTransferFreeBalanceClientA,
    freeBalanceNodeA: postTransferFreeBalanceNodeA,
    // tslint:disable-next-line:object-literal-sort-keys
    freeBalanceClientB: postTransferFreeBalanceClientB,
    freeBalanceNodeB: postTransferFreeBalanceNodeB,
  };

  return postTransfer;
}
