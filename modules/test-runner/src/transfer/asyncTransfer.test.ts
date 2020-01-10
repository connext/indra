import { xkeyKthAddress } from "@connext/cf-core";
import { IConnextClient } from "@connext/types";
import { AddressZero, Zero } from "ethers/constants";
import { parseEther } from "ethers/utils";

import { createClient } from "../util/client";

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

    const senderDone = new Promise((res: any): any => clientA.on("UNINSTALL_EVENT", res));
    const recipientDone = new Promise((res: any): any =>
      clientB.on("RECIEVE_TRANSFER_FINISHED_EVENT", res),
    );

    await clientA.transfer({
      amount: transferAmount.toString(),
      assetId: AddressZero,
      meta: { hello: "world" },
      recipient: clientB.publicIdentifier,
    });

    await recipientDone;

    // TODO: this doesn't work
    // await senderDone;

    const {
      [clientA.freeBalanceAddress]: postTransferFreeBalanceEthClientA,
      [nodeFreeBalanceAddress]: postTransferFreeBalanceEthNodeA,
    } = await clientA.getFreeBalance(AddressZero);

    const {
      [clientB.freeBalanceAddress]: postTransferFreeBalanceEthClientB,
      [nodeFreeBalanceAddress]: postTransferFreeBalanceEthNodeB,
    } = await clientB.getFreeBalance(AddressZero);

    expect(postTransferFreeBalanceEthClientA).toBeBigNumberEq(0);
    // expect(postTransferFreeBalanceEthNodeA).toBeBigNumberEq(transferAmount);

    expect(postTransferFreeBalanceEthClientB).toBeBigNumberEq(transferAmount);
    expect(postTransferFreeBalanceEthNodeB).toBeBigNumberEq(
      preTransferFreeBalanceEthNodeB.sub(transferAmount),
    );
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

    const senderDone = new Promise((res: any): any => clientA.on("UNINSTALL_EVENT", res));
    const recipientDone = new Promise((res: any): any =>
      clientB.on("RECIEVE_TRANSFER_FINISHED_EVENT", res),
    );

    await clientA.transfer({
      amount: transferAmount.toString(),
      assetId: tokenAddress,
      meta: { hello: "world" },
      recipient: clientB.publicIdentifier,
    });

    await recipientDone;

    // TODO: this doesn't work
    // await senderDone;

    const {
      [clientA.freeBalanceAddress]: postTransferFreeBalanceClientA,
      [nodeFreeBalanceAddress]: postTransferFreeBalanceNodeA,
    } = await clientA.getFreeBalance(tokenAddress);

    const {
      [clientB.freeBalanceAddress]: postTransferFreeBalanceClientB,
      [nodeFreeBalanceAddress]: postTransferFreeBalanceNodeB,
    } = await clientB.getFreeBalance(tokenAddress);

    expect(postTransferFreeBalanceClientA).toBeBigNumberEq(0);
    // expect(postTransferFreeBalanceNodeA).toBeBigNumberEq(transferAmount);

    expect(postTransferFreeBalanceClientB).toBeBigNumberEq(transferAmount);
    expect(postTransferFreeBalanceNodeB).toBeBigNumberEq(
      preTransferFreeBalanceNodeB.sub(transferAmount),
    );
  });
});
