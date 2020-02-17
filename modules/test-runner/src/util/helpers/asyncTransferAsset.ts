import { xkeyKthAddress } from "@connext/cf-core";
import { IConnextClient, RECEIVE_TRANSFER_FINISHED_EVENT, UNINSTALL_EVENT } from "@connext/types";
import { BigNumber } from "ethers/utils";

import { expect } from "../";
import { delay } from "../misc";
import { ExistingBalancesAsyncTransfer } from "../types";
import { RECEIVE_TRANSFER_FAILED_EVENT } from "@connext/types";

// NOTE: will fail if not collateralized by transfer amount exactly
// when pretransfer balances are not supplied.
export async function asyncTransferAsset(
  clientA: IConnextClient,
  clientB: IConnextClient,
  transferAmount: BigNumber,
  assetId: string,
): Promise<ExistingBalancesAsyncTransfer> {
  const nodeFreeBalanceAddress = xkeyKthAddress(clientA.nodePublicIdentifier);
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
    Promise.race([
      new Promise((resolve: Function): void => {
        clientB.once(RECEIVE_TRANSFER_FINISHED_EVENT, () => {
          resolve();
        });
      }),
      new Promise((resolve: Function, reject: Function): void => {
        clientB.once(RECEIVE_TRANSFER_FAILED_EVENT, (msg: any) => {
          reject(msg.error);
        });
      }),
    ]),
    new Promise((resolve: Function): void => {
      clientA.once(UNINSTALL_EVENT, () => resolve());
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
  expect((await clientB.getAppInstances()).length).to.be.eq(0);
  expect((await clientA.getAppInstances()).length).to.be.eq(0);

  const {
    [clientA.freeBalanceAddress]: postTransferFreeBalanceClientA,
    [nodeFreeBalanceAddress]: postTransferFreeBalanceNodeA,
  } = await clientA.getFreeBalance(assetId);
  expect(postTransferFreeBalanceClientA).to.equal(preTransferFreeBalanceClientA.sub(transferAmount));
  expect(postTransferFreeBalanceNodeA).equal(preTransferFreeBalanceNodeA.add(transferAmount));

  const {
    [clientB.freeBalanceAddress]: postTransferFreeBalanceClientB,
    [nodeFreeBalanceAddress]: postTransferFreeBalanceNodeB,
  } = await clientB.getFreeBalance(assetId);
  expect(postTransferFreeBalanceClientB).equal(preTransferFreeBalanceClientB.add(transferAmount));

  if (!preTransferFreeBalanceNodeB.isZero()) {
    expect(postTransferFreeBalanceNodeB).equal(preTransferFreeBalanceNodeB.sub(transferAmount));
  }

  // TODO: explicitly await for status redeemed -> reclaimed
  await delay(1000);

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
    freeBalanceClientB: postTransferFreeBalanceClientB,
    freeBalanceNodeB: postTransferFreeBalanceNodeB,
  };

  return postTransfer;
}
