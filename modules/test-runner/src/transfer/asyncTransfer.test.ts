import { xkeyKthAddress } from "@connext/cf-core";
import { IConnextClient } from "@connext/types";
import { AddressZero, Zero } from "ethers/constants";

import { createClient, ETH_AMOUNT_LG, ETH_AMOUNT_SM } from "../util";

describe("Async Transfers", () => {
  let clientA: IConnextClient;
  let clientB: IConnextClient;
  let tokenAddress: string;
  let nodeFreeBalanceAddress: string;
  let nodePublicIdentifier: string;

  beforeEach(async () => {
    clientA = await createClient();
    clientB = await createClient();

    tokenAddress = clientA.config.contractAddresses.Token;
    nodePublicIdentifier = clientA.config.nodePublicIdentifier;
    nodeFreeBalanceAddress = xkeyKthAddress(nodePublicIdentifier);
  }, 90_000);

  test("happy case: client A transfers eth to client B through node", async () => {
    const transferAmount = ETH_AMOUNT_SM;
    await clientA.deposit({ amount: transferAmount.toString(), assetId: AddressZero });
    await clientB.requestCollateral(AddressZero);

    const {
      [clientA.freeBalanceAddress]: preTransferFreeBalanceEthClientA,
      [nodeFreeBalanceAddress]: preTransferFreeBalanceEthNodeA,
    } = await clientA.getFreeBalance(AddressZero);
    expect(preTransferFreeBalanceEthClientA).toBeBigNumberEq(transferAmount);
    expect(preTransferFreeBalanceEthNodeA).toBeBigNumberEq(Zero);

    const {
      [clientB.freeBalanceAddress]: preTransferFreeBalanceEthClientB,
      [nodeFreeBalanceAddress]: preTransferFreeBalanceEthNodeB,
    } = await clientB.getFreeBalance(AddressZero);
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
        assetId: AddressZero,
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
    } = await clientA.getFreeBalance(AddressZero);
    expect(postTransferFreeBalanceEthClientA).toBeBigNumberEq(Zero);
    expect(postTransferFreeBalanceEthNodeA).toBeBigNumberEq(transferAmount);

    const {
      [clientB.freeBalanceAddress]: postTransferFreeBalanceEthClientB,
      [nodeFreeBalanceAddress]: postTransferFreeBalanceEthNodeB,
    } = await clientB.getFreeBalance(AddressZero);
    expect(postTransferFreeBalanceEthClientB).toBeBigNumberEq(transferAmount);
    expect(postTransferFreeBalanceEthNodeB).toBeBigNumberEq(
      preTransferFreeBalanceEthNodeB.sub(transferAmount),
    );

    // verify payment
    const paymentA = await clientA.getLinkedTransfer(paymentId);
    const paymentB = await clientB.getLinkedTransfer(paymentId);
    expect(paymentA).toMatchObject({
      amount: transferAmount.toString(),
      assetId: AddressZero,
      meta: { hello: "world" },
      paymentId,
      receiverPublicIdentifier: clientB.publicIdentifier,
      senderPublicIdentifier: clientA.publicIdentifier,
      status: "RECLAIMED",
      type: "LINKED",
    });
    expect(paymentB).toMatchObject(paymentA);
  });

  test("happy case: client A transfers tokens to client B through node", async () => {
    const transferAmount = ETH_AMOUNT_LG;
    await clientA.deposit({ amount: transferAmount.toString(), assetId: tokenAddress });
    await clientB.requestCollateral(tokenAddress);

    const {
      [clientA.freeBalanceAddress]: preTransferFreeBalanceClientA,
      [nodeFreeBalanceAddress]: preTransferFreeBalanceNodeA,
    } = await clientA.getFreeBalance(tokenAddress);
    expect(preTransferFreeBalanceClientA).toBeBigNumberEq(transferAmount);
    expect(preTransferFreeBalanceNodeA).toBeBigNumberEq(Zero);

    const {
      [clientB.freeBalanceAddress]: preTransferFreeBalanceClientB,
      [nodeFreeBalanceAddress]: preTransferFreeBalanceNodeB,
    } = await clientB.getFreeBalance(tokenAddress);
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
        assetId: tokenAddress,
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
    } = await clientA.getFreeBalance(tokenAddress);
    expect(postTransferFreeBalanceClientA).toBeBigNumberEq(Zero);
    expect(postTransferFreeBalanceNodeA).toBeBigNumberEq(transferAmount);

    const {
      [clientB.freeBalanceAddress]: postTransferFreeBalanceClientB,
      [nodeFreeBalanceAddress]: postTransferFreeBalanceNodeB,
    } = await clientB.getFreeBalance(tokenAddress);
    expect(postTransferFreeBalanceClientB).toBeBigNumberEq(transferAmount);
    expect(postTransferFreeBalanceNodeB).toBeBigNumberEq(
      preTransferFreeBalanceNodeB.sub(transferAmount),
    );

    // verify payment
    const paymentA = await clientA.getLinkedTransfer(paymentId);
    const paymentB = await clientB.getLinkedTransfer(paymentId);
    expect(paymentA).toMatchObject({
      amount: transferAmount.toString(),
      assetId: tokenAddress,
      meta: { hello: "world" },
      paymentId,
      receiverPublicIdentifier: clientB.publicIdentifier,
      senderPublicIdentifier: clientA.publicIdentifier,
      status: "RECLAIMED",
      type: "LINKED",
    });
    expect(paymentB).toMatchObject(paymentA);
  });
});
