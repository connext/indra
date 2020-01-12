import { IConnextClient } from "@connext/types";
import { AddressZero, Zero } from "ethers/constants";
import { BigNumber } from "ethers/utils";

export async function asyncTransferAsset(
  clientA: IConnextClient,
  clientB: IConnextClient,
  transferAmount: BigNumber,
  assetId: string,
  nodeFreeBalanceAddress: string,
): Promise<string> {
  if (assetId === AddressZero) {
    const {
      [clientA.freeBalanceAddress]: preTransferFreeBalanceEthClientA,
      [nodeFreeBalanceAddress]: preTransferFreeBalanceEthNodeA,
    } = await clientA.getFreeBalance(assetId);
    expect(preTransferFreeBalanceEthClientA).toBeBigNumberEq(transferAmount);
    expect(preTransferFreeBalanceEthNodeA).toBeBigNumberEq(Zero);

    const {
      [clientB.freeBalanceAddress]: preTransferFreeBalanceEthClientB,
      [nodeFreeBalanceAddress]: preTransferFreeBalanceEthNodeB,
    } = await clientB.getFreeBalance(assetId);
    expect(preTransferFreeBalanceEthClientB).toBeBigNumberEq(Zero);
    expect(preTransferFreeBalanceEthNodeB).toBeBigNumberGte(transferAmount);

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
    expect((await clientB.getAppInstances()).length).toEqual(Zero.toNumber());
    expect((await clientA.getAppInstances()).length).toEqual(Zero.toNumber());

    const {
      [clientA.freeBalanceAddress]: postTransferFreeBalanceEthClientA,
      [nodeFreeBalanceAddress]: postTransferFreeBalanceEthNodeA,
    } = await clientA.getFreeBalance(assetId);
    expect(postTransferFreeBalanceEthClientA).toBeBigNumberEq(Zero);
    expect(postTransferFreeBalanceEthNodeA).toBeBigNumberEq(transferAmount);

    const {
      [clientB.freeBalanceAddress]: postTransferFreeBalanceEthClientB,
      [nodeFreeBalanceAddress]: postTransferFreeBalanceEthNodeB,
    } = await clientB.getFreeBalance(assetId);
    expect(postTransferFreeBalanceEthClientB).toBeBigNumberEq(transferAmount);
    expect(postTransferFreeBalanceEthNodeB).toBeBigNumberEq(
      preTransferFreeBalanceEthNodeB.sub(transferAmount),
    );

    return paymentId;
  } else {
    const {
      [clientA.freeBalanceAddress]: preTransferFreeBalanceClientA,
      [nodeFreeBalanceAddress]: preTransferFreeBalanceNodeA,
    } = await clientA.getFreeBalance(assetId);
    expect(preTransferFreeBalanceClientA).toBeBigNumberEq(transferAmount);
    expect(preTransferFreeBalanceNodeA).toBeBigNumberEq(Zero);

    const {
      [clientB.freeBalanceAddress]: preTransferFreeBalanceClientB,
      [nodeFreeBalanceAddress]: preTransferFreeBalanceNodeB,
    } = await clientB.getFreeBalance(assetId);
    expect(preTransferFreeBalanceClientB).toBeBigNumberEq(Zero);
    expect(preTransferFreeBalanceNodeB).toBeBigNumberGte(transferAmount);

    let paymentId;
    await new Promise(async resolve => {
      let count = 0;
      clientA.once("UNINSTALL_EVENT", async () => {
        console.error(`Caught sender uninstall event!!!!!`);
        count += 1;
        if (count === 2) {
          console.error(`resolving promise!`);
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
    expect((await clientB.getAppInstances()).length).toEqual(Zero.toNumber());
    expect((await clientA.getAppInstances()).length).toEqual(Zero.toNumber());

    const {
      [clientA.freeBalanceAddress]: postTransferFreeBalanceClientA,
      [nodeFreeBalanceAddress]: postTransferFreeBalanceNodeA,
    } = await clientA.getFreeBalance(assetId);
    expect(postTransferFreeBalanceClientA).toBeBigNumberEq(Zero);
    expect(postTransferFreeBalanceNodeA).toBeBigNumberEq(transferAmount);

    const {
      [clientB.freeBalanceAddress]: postTransferFreeBalanceClientB,
      [nodeFreeBalanceAddress]: postTransferFreeBalanceNodeB,
    } = await clientB.getFreeBalance(assetId);
    expect(postTransferFreeBalanceClientB).toBeBigNumberEq(transferAmount);
    expect(postTransferFreeBalanceNodeB).toBeBigNumberEq(
      preTransferFreeBalanceNodeB.sub(transferAmount),
    );

    return paymentId;
  }
}

export async function verifyPayment(
  clientA: IConnextClient,
  clientB: IConnextClient,
  transferAmount: BigNumber,
  assetId: string,
  paymentId: string,
): Promise<void> {
  // verify payment
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
}
