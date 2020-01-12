import { IConnextClient } from "@connext/types";
import { Zero } from "ethers/constants";
import { BigNumber } from "ethers/utils";

interface ExistingBalances {
  freeBalanceClientA: BigNumber;
  freeBalanceClientB: BigNumber;
  freeBalanceNodeA: BigNumber;
  freeBalanceNodeB: BigNumber;
}

function parseExistingBalances(
  transferAmount: BigNumber,
  preExistingBalances?: Partial<ExistingBalances>,
): ExistingBalances {
  const defaultExistingBalances: ExistingBalances = {
    freeBalanceClientA: transferAmount,
    freeBalanceClientB: Zero,
    freeBalanceNodeA: Zero,
    freeBalanceNodeB: transferAmount,
  };

  const existingBalances = !preExistingBalances
    ? defaultExistingBalances
    : {
        freeBalanceClientA:
          preExistingBalances.freeBalanceClientA || defaultExistingBalances.freeBalanceClientA,
        freeBalanceClientB:
          preExistingBalances.freeBalanceClientB || defaultExistingBalances.freeBalanceClientB,
        freeBalanceNodeA:
          preExistingBalances.freeBalanceNodeA || defaultExistingBalances.freeBalanceNodeA,
        freeBalanceNodeB:
          preExistingBalances.freeBalanceNodeB || defaultExistingBalances.freeBalanceNodeB,
      };

  return existingBalances;
}

export async function asyncTransferAsset(
  clientA: IConnextClient,
  clientB: IConnextClient,
  transferAmount: BigNumber,
  assetId: string,
  nodeFreeBalanceAddress: string,
  preExistingBalances?: Partial<ExistingBalances>,
): Promise<void> {
  const existingBalances = parseExistingBalances(transferAmount, preExistingBalances);

  const {
    [clientA.freeBalanceAddress]: preTransferFreeBalanceClientA,
    [nodeFreeBalanceAddress]: preTransferFreeBalanceNodeA,
  } = await clientA.getFreeBalance(assetId);
  expect(preTransferFreeBalanceClientA).toBeBigNumberEq(existingBalances.freeBalanceClientA);
  expect(preTransferFreeBalanceNodeA).toBeBigNumberEq(existingBalances.freeBalanceNodeA);

  const {
    [clientB.freeBalanceAddress]: preTransferFreeBalanceClientB,
    [nodeFreeBalanceAddress]: preTransferFreeBalanceNodeB,
  } = await clientB.getFreeBalance(assetId);
  expect(preTransferFreeBalanceClientB).toBeBigNumberEq(existingBalances.freeBalanceClientB);
  expect(preTransferFreeBalanceNodeB).toBeBigNumberGte(existingBalances.freeBalanceNodeB);

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
}
