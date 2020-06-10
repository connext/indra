import { EventNames, IConnextClient, LinkedTransferStatus, Address } from "@connext/types";
import { ColorfulLogger, getRandomBytes32, stringify } from "@connext/utils";
import { BigNumber } from "ethers";

import { env } from "../env";
import { expect } from "../";
import { ExistingBalancesAsyncTransfer } from "../types";

const log = new ColorfulLogger("AsyncTransfer", env.logLevel);

export async function asyncTransferAsset(
  clientA: IConnextClient,
  clientB: IConnextClient,
  transferAmount: BigNumber,
  assetId: Address,
): Promise<ExistingBalancesAsyncTransfer> {
  const SENDER_INPUT_META = { hello: "world" };
  const nodeSignerAddress = clientA.nodeSignerAddress;
  const {
    [clientA.signerAddress]: preTransferFreeBalanceClientA,
    [nodeSignerAddress]: preTransferFreeBalanceNodeA,
  } = await clientA.getFreeBalance(assetId);
  const {
    [clientB.signerAddress]: preTransferFreeBalanceClientB,
    [nodeSignerAddress]: preTransferFreeBalanceNodeB,
  } = await clientB.getFreeBalance(assetId);
  const paymentId = getRandomBytes32();

  const transferFinished = () => {
    return Promise.all([
      new Promise((resolve, reject) => {
        clientB.on(EventNames.CONDITIONAL_TRANSFER_UNLOCKED_EVENT, (data) => {
          log.debug(`Got recipient transfer unlocked event with ${stringify(data)}`);
          expect(data.paymentId).to.be.ok;
          if (data.paymentId === paymentId) {
            expect(data).to.deep.include({
              amount: transferAmount,
              sender: clientA.publicIdentifier,
              recipient: clientB.publicIdentifier,
              paymentId,
            });
            return resolve();
          }
        });
        clientB.on(EventNames.CONDITIONAL_TRANSFER_FAILED_EVENT, (data) => {
          log.debug(`Got recipient transfer failed event with ${stringify(data)}`);
          expect(data.paymentId).to.be.ok;
          expect(data.error).to.be.ok;
          if (data.paymentId === paymentId) {
            return reject(new Error(data.error));
          }
        });
      }),
      new Promise((resolve) => {
        clientA.on(EventNames.CONDITIONAL_TRANSFER_UNLOCKED_EVENT, (data) => {
          log.debug(`Got sender transfer unlocked event with ${stringify(data)}`);
          if (data.paymentId === paymentId) {
            return resolve();
          }
        });
      }),
    ]);
  };

  const start = Date.now();
  log.info(`call client.transfer()`);
  const { appIdentityHash } = await clientA.transfer({
    amount: transferAmount.toString(),
    assetId,
    meta: { ...SENDER_INPUT_META },
    recipient: clientB.publicIdentifier,
    paymentId,
  });
  log.info(`transfer() returned in ${Date.now() - start}ms`);

  await transferFinished();
  log.info(`Got transfer finished event in ${Date.now() - start}ms`);

  const appInstanceCheck = await clientA.getAppInstance(appIdentityHash);
  expect(appInstanceCheck).to.be.undefined;

  const {
    [clientA.signerAddress]: postTransferFreeBalanceClientA,
    [nodeSignerAddress]: postTransferFreeBalanceNodeA,
  } = await clientA.getFreeBalance(assetId);

  const {
    [clientB.signerAddress]: postTransferFreeBalanceClientB,
    [nodeSignerAddress]: postTransferFreeBalanceNodeB,
  } = await clientB.getFreeBalance(assetId);

  expect(postTransferFreeBalanceClientA).to.equal(
    preTransferFreeBalanceClientA.sub(transferAmount),
  );
  expect(postTransferFreeBalanceNodeA).to.be.at.least(
    preTransferFreeBalanceNodeA.add(transferAmount),
  );
  expect(postTransferFreeBalanceClientB).equal(preTransferFreeBalanceClientB.add(transferAmount));

  // node could have collateralized
  expect(postTransferFreeBalanceNodeB.add(transferAmount)).to.be.at.least(
    preTransferFreeBalanceNodeB,
  );

  const paymentA = await clientA.getLinkedTransfer(paymentId);
  const paymentB = await clientB.getLinkedTransfer(paymentId);
  expect(paymentA).to.deep.include({
    amount: transferAmount,
    assetId,
    paymentId,
    receiverIdentifier: clientB.publicIdentifier,
    senderIdentifier: clientA.publicIdentifier,
    status: LinkedTransferStatus.COMPLETED,
    meta: { ...SENDER_INPUT_META, sender: clientA.publicIdentifier, paymentId },
  });
  expect(paymentA.encryptedPreImage).to.be.ok;

  expect(paymentA).to.deep.include(paymentB);

  const postTransfer: ExistingBalancesAsyncTransfer = {
    freeBalanceClientA: postTransferFreeBalanceClientA,
    freeBalanceClientB: postTransferFreeBalanceClientB,
    freeBalanceNodeA: postTransferFreeBalanceNodeA,
    freeBalanceNodeB: postTransferFreeBalanceNodeB,
  };

  return postTransfer;
}
