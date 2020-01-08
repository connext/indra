import { xkeyKthAddress } from "@connext/cf-core";
import { IConnextClient } from "@connext/types";
import { AddressZero } from "ethers/constants";
import { parseEther } from "ethers/utils";

import { createClient } from "../util/client";

describe.only("Async Transfers", () => {
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
    const transferAmount = parseEther("0.01");
    await clientA.deposit({ amount: transferAmount.toString(), assetId: AddressZero });
    await clientB.requestCollateral(AddressZero);

    const {
      [clientA.freeBalanceAddress]: preTransferFreeBalanceEthClientA,
      [nodeFreeBalanceAddress]: preTransferFreeBalanceEthNodeA,
    } = await clientA.getFreeBalance(AddressZero);

    const {
      [clientB.freeBalanceAddress]: preTransferFreeBalanceEthClientB,
      [nodeFreeBalanceAddress]: preTransferFreeBalanceEthNodeB,
    } = await clientB.getFreeBalance(AddressZero);

    expect(preTransferFreeBalanceEthClientA).toBeBigNumberEq(transferAmount);
    expect(preTransferFreeBalanceEthNodeA).toBeBigNumberEq(0);

    expect(preTransferFreeBalanceEthClientB).toBeBigNumberEq(0);
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

      const { paymentId: senderPaymentId, preImage: linkedPreImage } = await clientA.transfer({
        amount: transferAmount.toString(),
        assetId: AddressZero,
        meta: { hello: "world" },
        recipient: clientB.publicIdentifier,
      });
      paymentId = senderPaymentId;
    });
    expect((await clientB.getAppInstances()).length).toEqual(0);
    expect((await clientA.getAppInstances()).length).toEqual(0);

    const {
      [clientA.freeBalanceAddress]: postTransferFreeBalanceEthClientA,
      [nodeFreeBalanceAddress]: postTransferFreeBalanceEthNodeA,
    } = await clientA.getFreeBalance(AddressZero);

    const {
      [clientB.freeBalanceAddress]: postTransferFreeBalanceEthClientB,
      [nodeFreeBalanceAddress]: postTransferFreeBalanceEthNodeB,
    } = await clientB.getFreeBalance(AddressZero);

    expect(postTransferFreeBalanceEthClientA).toBeBigNumberEq(0);
    expect(postTransferFreeBalanceEthNodeA).toBeBigNumberEq(transferAmount);

    expect(postTransferFreeBalanceEthClientB).toBeBigNumberEq(transferAmount);
    expect(postTransferFreeBalanceEthNodeB).toBeBigNumberEq(
      preTransferFreeBalanceEthNodeB.sub(transferAmount),
    );

    // verify payment
    const paymentA = await clientA.getLinkedTransfer(paymentId);
    const paymentB = await clientB.getLinkedTransfer(paymentId);
    expect(paymentA).toMatchObject({
      paymentId,
      assetId: AddressZero,
      amount: transferAmount.toString(),
      status: "RECLAIMED",
      type: "LINKED",
      senderPublicIdentifier: clientA.publicIdentifier,
      receiverPublicIdentifier: clientB.publicIdentifier,
      meta: { hello: "world" },
    });
    expect(paymentB).toMatchObject(paymentA);
  });

  test("happy case: client A transfers tokens to client B through node", async () => {
    const transferAmount = parseEther("1");
    await clientA.deposit({ amount: transferAmount.toString(), assetId: tokenAddress });
    await clientB.requestCollateral(tokenAddress);

    const {
      [clientA.freeBalanceAddress]: preTransferFreeBalanceClientA,
      [nodeFreeBalanceAddress]: preTransferFreeBalanceNodeA,
    } = await clientA.getFreeBalance(tokenAddress);

    const {
      [clientB.freeBalanceAddress]: preTransferFreeBalanceClientB,
      [nodeFreeBalanceAddress]: preTransferFreeBalanceNodeB,
    } = await clientB.getFreeBalance(tokenAddress);

    expect(preTransferFreeBalanceClientA).toBeBigNumberEq(transferAmount);
    expect(preTransferFreeBalanceNodeA).toBeBigNumberEq(0);

    expect(preTransferFreeBalanceClientB).toBeBigNumberEq(0);
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
    expect((await clientB.getAppInstances()).length).toEqual(0);
    expect((await clientA.getAppInstances()).length).toEqual(0);

    const {
      [clientA.freeBalanceAddress]: postTransferFreeBalanceClientA,
      [nodeFreeBalanceAddress]: postTransferFreeBalanceNodeA,
    } = await clientA.getFreeBalance(tokenAddress);

    const {
      [clientB.freeBalanceAddress]: postTransferFreeBalanceClientB,
      [nodeFreeBalanceAddress]: postTransferFreeBalanceNodeB,
    } = await clientB.getFreeBalance(tokenAddress);

    expect(postTransferFreeBalanceClientA).toBeBigNumberEq(0);
    expect(postTransferFreeBalanceNodeA).toBeBigNumberEq(transferAmount);

    expect(postTransferFreeBalanceClientB).toBeBigNumberEq(transferAmount);
    expect(postTransferFreeBalanceNodeB).toBeBigNumberEq(
      preTransferFreeBalanceNodeB.sub(transferAmount),
    );

    // verify payment
    const paymentA = await clientA.getLinkedTransfer(paymentId);
    const paymentB = await clientB.getLinkedTransfer(paymentId);
    expect(paymentA).toMatchObject({
      paymentId,
      assetId: tokenAddress,
      amount: transferAmount.toString(),
      status: "RECLAIMED",
      type: "LINKED",
      senderPublicIdentifier: clientA.publicIdentifier,
      receiverPublicIdentifier: clientB.publicIdentifier,
      meta: { hello: "world" },
    });
    expect(paymentB).toMatchObject(paymentA);
  });
});
