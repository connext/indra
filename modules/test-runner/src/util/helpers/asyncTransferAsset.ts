import { EventNames, IConnextClient, LinkedTransferStatus, Address } from "@connext/types";
import { ColorfulLogger } from "@connext/utils";
import { BigNumber } from "ethers";
import { Client } from "ts-nats";

import { env } from "../env";
import { expect } from "../";
import { ExistingBalancesAsyncTransfer } from "../types";

const log = new ColorfulLogger("AsyncTransfer", env.logLevel);

export async function asyncTransferAsset(
  clientA: IConnextClient,
  clientB: IConnextClient,
  transferAmount: BigNumber,
  assetId: Address,
  nats: Client, // TODO: remove
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

  let paymentId: string;

  const transferFinished = (senderAppId: string) =>
    Promise.all([
      Promise.race([
        new Promise((resolve: Function): void => {
          clientB.once(EventNames.CONDITIONAL_TRANSFER_UNLOCKED_EVENT, (data) => {
            expect(data).to.deep.include({
              amount: transferAmount,
              sender: clientA.publicIdentifier,
              recipient: clientB.publicIdentifier,
            });
            resolve();
          });
        }),
        new Promise((resolve: Function, reject: Function): void => {
          clientB.once(EventNames.CONDITIONAL_TRANSFER_FAILED_EVENT, (msg: any) => {
            reject(msg.error);
          });
        }),
      ]),
      new Promise((resolve: Function): void => {
        clientA.on(EventNames.CONDITIONAL_TRANSFER_UNLOCKED_EVENT, (data) => {
          // TODO: Sender/recipient are undefined here because https://github.com/ConnextProject/indra/issues/1054
          resolve();
        });
      }),
    ]);

  let start = Date.now();
  log.info(`call client.transfer()`);
  const { paymentId: senderPaymentId, appIdentityHash } = await clientA.transfer({
    amount: transferAmount.toString(),
    assetId,
    meta: { ...SENDER_INPUT_META },
    recipient: clientB.publicIdentifier,
  });
  log.info(`transfer() returned in ${Date.now() - start}ms`);
  paymentId = senderPaymentId;

  await transferFinished(appIdentityHash);
  log.info(`Got transfer finished event in ${Date.now() - start}ms`);

  const appInstanceCheck = await clientA.getAppInstance(appIdentityHash);
  expect(appInstanceCheck).to.be.undefined;

  const {
    [clientA.signerAddress]: postTransferFreeBalanceClientA,
    [nodeSignerAddress]: postTransferFreeBalanceNodeA,
  } = await clientA.getFreeBalance(assetId);
  expect(postTransferFreeBalanceClientA).to.equal(
    preTransferFreeBalanceClientA.sub(transferAmount),
  );
  expect(postTransferFreeBalanceNodeA).to.be.at.least(
    preTransferFreeBalanceNodeA.add(transferAmount),
  );

  const {
    [clientB.signerAddress]: postTransferFreeBalanceClientB,
    [nodeSignerAddress]: postTransferFreeBalanceNodeB,
  } = await clientB.getFreeBalance(assetId);
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
    meta: { ...SENDER_INPUT_META, sender: clientA.publicIdentifier },
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
