import { EventNames, IConnextClient, LinkedTransferStatus, Address } from "@connext/types";
import { getRandomBytes32, getAddressFromAssetId, stringify, delay } from "@connext/utils";
import { BigNumber } from "ethers";

import { expect } from "../assertions";
import { getTestLoggers } from "../misc";

const { log } = getTestLoggers("AsyncTransfer");

interface ExistingBalancesAsyncTransfer {
  freeBalanceClientA: BigNumber;
  freeBalanceNodeA: BigNumber;
  freeBalanceClientB: BigNumber;
  freeBalanceNodeB: BigNumber;
}

export const asyncTransferAsset = async (
  clientA: IConnextClient,
  clientB: IConnextClient,
  transferAmount: BigNumber,
  assetId: Address,
): Promise<ExistingBalancesAsyncTransfer> => {
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

  const start = Date.now();
  let appIdentityHash;
  await Promise.all([
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
    new Promise((resolve, reject) => {
      log.info(`call client.transfer()`);
      clientA
        .transfer({
          amount: transferAmount.toString(),
          assetId,
          meta: { ...SENDER_INPUT_META },
          recipient: clientB.publicIdentifier,
          paymentId,
        })
        .then((res) => {
          log.info(`transfer() returned in ${Date.now() - start}ms`);
          appIdentityHash = res.appIdentityHash;
          resolve();
        })
        .catch(reject);
      delay(30_000).then(() => reject("Transfer did not finish within 30s"));
    }),
  ]);

  log.info(`Got transfer finished events in ${Date.now() - start}ms`);

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
    assetId: getAddressFromAssetId(assetId),
    paymentId,
    receiverIdentifier: clientB.publicIdentifier,
    senderIdentifier: clientA.publicIdentifier,
    status: LinkedTransferStatus.COMPLETED,
    meta: {
      ...SENDER_INPUT_META,
      sender: clientA.publicIdentifier,
      paymentId,
      senderAssetId: getAddressFromAssetId(assetId),
    },
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
};
