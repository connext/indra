import { xkeyKthAddress } from "@connext/cf-core";
<<<<<<< HEAD
import { EventNames, IConnextClient } from "@connext/types";
=======
import {
  IConnextClient,
  RECEIVE_TRANSFER_FAILED_EVENT,
  RECEIVE_TRANSFER_FINISHED_EVENT,
  UNINSTALL_EVENT,
  LinkedTransferStatus,
} from "@connext/types";
>>>>>>> nats-messaging-refactor
import { BigNumber } from "ethers/utils";
import { Client } from "ts-nats";

import { env } from "../env";
import { Logger } from "../logger";
import { expect } from "../";
import { ExistingBalancesAsyncTransfer } from "../types";

const log = new Logger("AsyncTransfer", env.logLevel);

// NOTE: will fail if not collateralized by transfer amount exactly
// when pretransfer balances are not supplied.
export async function asyncTransferAsset(
  clientA: IConnextClient,
  clientB: IConnextClient,
  transferAmount: BigNumber,
  assetId: string,
  nats: Client,
): Promise<ExistingBalancesAsyncTransfer> {
  const SENDER_INPUT_META = { hello: "world" };
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

<<<<<<< HEAD
  const transferFinished = Promise.all([
    Promise.race([
      new Promise((resolve: Function): void => {
        clientB.once(EventNames.RECEIVE_TRANSFER_FINISHED_EVENT, data => {
          expect(data).to.deep.include({
            amount: transferAmount,
            sender: clientA.publicIdentifier,
          });
          resolve();
        });
      }),
      new Promise((resolve: Function, reject: Function): void => {
        clientB.once(EventNames.RECEIVE_TRANSFER_FAILED_EVENT, (msg: any) => {
          reject(msg.error);
        });
      }),
    ]),
    new Promise((resolve: Function): void => {
      clientA.once(EventNames.UNINSTALL_EVENT, () => resolve());
    }),
  ]);

  let start = Date.now();
  log.info(`call client.transfer()`);
  const { paymentId: senderPaymentId } = await clientA.transfer({
    amount: transferAmount,
=======
  const transferFinished = (senderAppId: string) =>
    Promise.all([
      Promise.race([
        new Promise((resolve: Function): void => {
          clientB.once(RECEIVE_TRANSFER_FINISHED_EVENT, data => {
            expect(data).to.deep.include({
              amount: transferAmount.toString(),
              sender: clientA.publicIdentifier,
            });
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
        clientA.once(UNINSTALL_EVENT, data => {
          if (data.appInstanceId === senderAppId) {
            resolve();
          }
        });
      }),
    ]);

  let start = Date.now();
  log.info(`call client.transfer()`);
  const { paymentId: senderPaymentId, appId } = await clientA.transfer({
    amount: transferAmount.toString(),
>>>>>>> nats-messaging-refactor
    assetId,
    meta: { ...SENDER_INPUT_META },
    recipient: clientB.publicIdentifier,
  });
  log.info(`transfer() returned in ${Date.now() - start}ms`);
  paymentId = senderPaymentId;

  await transferFinished(appId);
  log.info(`Got transfer finished event in ${Date.now() - start}ms`);

  expect((await clientB.getAppInstances()).length).to.be.eq(0);
  expect((await clientA.getAppInstances()).length).to.be.eq(0);

  const {
    [clientA.freeBalanceAddress]: postTransferFreeBalanceClientA,
    [nodeFreeBalanceAddress]: postTransferFreeBalanceNodeA,
  } = await clientA.getFreeBalance(assetId);
  expect(postTransferFreeBalanceClientA).to.equal(
    preTransferFreeBalanceClientA.sub(transferAmount),
  );
  expect(postTransferFreeBalanceNodeA).equal(preTransferFreeBalanceNodeA.add(transferAmount));

  const {
    [clientB.freeBalanceAddress]: postTransferFreeBalanceClientB,
    [nodeFreeBalanceAddress]: postTransferFreeBalanceNodeB,
  } = await clientB.getFreeBalance(assetId);
  expect(postTransferFreeBalanceClientB).equal(preTransferFreeBalanceClientB.add(transferAmount));

  if (!preTransferFreeBalanceNodeB.isZero()) {
    expect(postTransferFreeBalanceNodeB).equal(preTransferFreeBalanceNodeB.sub(transferAmount));
  }

  const paymentA = await clientA.getLinkedTransfer(paymentId);
  const paymentB = await clientB.getLinkedTransfer(paymentId);
  expect(paymentA).to.deep.include({
    amount: transferAmount,
    assetId,
    paymentId,
    receiverPublicIdentifier: clientB.publicIdentifier,
    senderPublicIdentifier: clientA.publicIdentifier,
    status: LinkedTransferStatus.REDEEMED,
    meta: { ...SENDER_INPUT_META },
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
