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

    await clientA.transfer({
      amount: transferAmount.toString(),
      assetId: AddressZero,
      meta: { hello: "world" },
      recipient: clientB.publicIdentifier,
    });

    await new Promise(res => {
      clientB.on("RECIEVE_TRANSFER_FINISHED_EVENT", () => {
        res();
      });
    });

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
  });
});
