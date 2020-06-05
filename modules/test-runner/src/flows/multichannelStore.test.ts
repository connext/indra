import {
  IConnextClient,
  CONVENTION_FOR_ETH_ASSET_ID,
  EventNames,
  PublicParams,
  ConditionalTransferTypes,
  Address,
  PrivateKey,
  Receipt,
  Bytes32,
} from "@connext/types";
import { getPostgresStore } from "@connext/store";
import { ConnextClient } from "@connext/client";
import {
  toBN,
  getRandomBytes32,
  getTestVerifyingContract,
  getTestReceiptToSign,
  getRandomPrivateKey,
  signReceiptMessage,
} from "@connext/utils";
import { Sequelize } from "sequelize";
import { BigNumber } from "ethers";

import { createClient, fundChannel, ETH_AMOUNT_MD, expect, env } from "../util";

// NOTE: only groups correct number of promises associated with a payment.
// there is no validation done to ensure the events correspond to the payments,
// or to ensure that the event payloads are correct.

const registerFailureListeners = (reject: any, sender: ConnextClient, recipient: ConnextClient) => {
  recipient.on(EventNames.PROPOSE_INSTALL_FAILED_EVENT, reject);
  sender.on(EventNames.PROPOSE_INSTALL_FAILED_EVENT, reject);
  recipient.on(EventNames.INSTALL_FAILED_EVENT, reject);
  sender.on(EventNames.INSTALL_FAILED_EVENT, reject);
  recipient.on(EventNames.UPDATE_STATE_FAILED_EVENT, reject);
  sender.on(EventNames.UPDATE_STATE_FAILED_EVENT, reject);
  recipient.on(EventNames.UNINSTALL_FAILED_EVENT, reject);
  sender.on(EventNames.UNINSTALL_FAILED_EVENT, reject);
  recipient.on(EventNames.CONDITIONAL_TRANSFER_FAILED_EVENT, reject);
  sender.on(EventNames.CONDITIONAL_TRANSFER_FAILED_EVENT, reject);
};

const performConditionalTransfer = async (params: {
  ASSET: string;
  TRANSFER_AMT: BigNumber;
  conditionType: ConditionalTransferTypes;
  sender: IConnextClient;
  recipient: IConnextClient;
  chainId?: number;
  verifyingContract?: Address;
  requestCID?: Bytes32;
  subgraphDeploymentID?: Bytes32;
  paymentId?: string;
  secret?: string; // preimage for linked
  meta?: any;
}): Promise<[string, string]> => {
  const {
    ASSET,
    TRANSFER_AMT,
    sender,
    recipient,
    conditionType,
    chainId,
    verifyingContract,
    requestCID,
    subgraphDeploymentID,
    paymentId,
    secret,
    meta,
  } = params;
  let TRANSFER_PARAMS;
  const baseParams = {
    conditionType,
    amount: TRANSFER_AMT,
    assetId: ASSET,
    paymentId: paymentId || getRandomBytes32(),
    recipient: recipient.publicIdentifier,
    meta,
  };
  const networkContext = await sender.ethProvider.getNetwork();
  const receipt = getTestReceiptToSign();
  switch (conditionType) {
    case ConditionalTransferTypes.LinkedTransfer: {
      TRANSFER_PARAMS = {
        ...baseParams,
        preImage: secret || getRandomBytes32(),
      } as PublicParams.LinkedTransfer;
      break;
    }
    case ConditionalTransferTypes.HashLockTransfer: {
      throw new Error(`Test util not yet configured for hashlock transfer`);
    }
    case ConditionalTransferTypes.SignedTransfer: {
      TRANSFER_PARAMS = {
        ...baseParams,
        signerAddress: recipient.signerAddress,
        chainId: chainId || networkContext.chainId,
        verifyingContract: verifyingContract || getTestVerifyingContract(),
        requestCID: requestCID || receipt.requestCID,
        subgraphDeploymentID: subgraphDeploymentID || receipt.subgraphDeploymentID,
      } as PublicParams.SignedTransfer;
      break;
    }
  }

  // send transfers from sender to recipient
  const [senderResponse] = await Promise.all([
    new Promise(async (resolve, reject) => {
      sender.once(EventNames.CONDITIONAL_TRANSFER_FAILED_EVENT, () => reject());
      try {
        const res = await sender.conditionalTransfer(TRANSFER_PARAMS);
        return resolve(res);
      } catch (e) {
        return reject(e.message);
      }
    }),
    new Promise((resolve, reject) => {
      recipient.once(EventNames.CONDITIONAL_TRANSFER_UNLOCKED_EVENT, (data) => {
        return resolve(data);
      });
      recipient.once(EventNames.CONDITIONAL_TRANSFER_FAILED_EVENT, () => reject());
    }),
    new Promise((resolve) => {
      sender.once(EventNames.CONDITIONAL_TRANSFER_UNLOCKED_EVENT, (data) => {
        return resolve(data);
      });
    }),
  ]);

  // preimage is undefined for signed transfers
  const { preImage, paymentId: responsePaymentId } = senderResponse as any;

  return [responsePaymentId, preImage] as [string, string];
};

describe("Full Flow: Multichannel stores (clients share single sequelize instance)", () => {
  let senderPrivateKey: PrivateKey;
  let sender: ConnextClient;
  let recipientPrivateKey: PrivateKey;
  let recipient: ConnextClient;
  let receipt: Receipt;
  let chainId: number;
  let verifyingContract: Address;
  let initialSenderFb: { [x: string]: string | BigNumber };
  let initialRecipientFb: { [x: string]: BigNumber };

  const DEPOSIT_AMT = ETH_AMOUNT_MD;
  const ASSET = CONVENTION_FOR_ETH_ASSET_ID;

  beforeEach(async () => {
    const { host, port, user: username, password, database } = env.dbConfig;
    const sequelize = new Sequelize({
      host,
      port,
      username,
      password,
      database,
      dialect: "postgres",
      logging: false,
    });
    // create stores with different prefixes
    const senderStore = getPostgresStore(sequelize, { prefix: "sender" });
    const recipientStore = getPostgresStore(sequelize, { prefix: "recipient" });
    // create clients with shared store
    senderPrivateKey = getRandomPrivateKey();
    sender = (await createClient({
      signer: senderPrivateKey,
      store: senderStore,
      id: "S",
    })) as ConnextClient;
    recipientPrivateKey = getRandomPrivateKey();
    recipient = (await createClient({
      signer: recipientPrivateKey,
      store: recipientStore,
      id: "R",
    })) as ConnextClient;
    receipt = getTestReceiptToSign();
    chainId = (await sender.ethProvider.getNetwork()).chainId;
    verifyingContract = getTestVerifyingContract();
    await fundChannel(sender, DEPOSIT_AMT, ASSET);
    initialSenderFb = await sender.getFreeBalance(ASSET);
    initialRecipientFb = await recipient.getFreeBalance(ASSET);
  });

  afterEach(async () => {
    await sender.messaging.disconnect();
    await recipient.messaging.disconnect();
    // clear stores
    await sender.store.clear();
    await recipient.store.clear();
  });

  it("should work when clients share the same sequelize instance with a different prefix (1 linked payment sent)", async () => {
    // establish tests constants
    const TRANSFER_AMT = toBN(100);

    await performConditionalTransfer({
      conditionType: ConditionalTransferTypes.LinkedTransfer,
      sender,
      recipient,
      ASSET,
      TRANSFER_AMT,
    });

    // verify transfer amounts
    const finalSenderFb = await sender.getFreeBalance(ASSET);
    const finalRecipientFb = await recipient.getFreeBalance(ASSET);
    expect(finalSenderFb[sender.signerAddress]).to.be.eq(
      initialSenderFb[sender.signerAddress].sub(TRANSFER_AMT),
    );
    expect(finalRecipientFb[recipient.signerAddress]).to.be.eq(
      initialRecipientFb[recipient.signerAddress].add(TRANSFER_AMT),
    );
  });

  it("should work when clients share the same sequelize instance with a different prefix (1 signed transfer payment sent)", async () => {
    // establish tests constants
    const TRANSFER_AMT = toBN(100);

    // register listener to resolve payment
    recipient.once(EventNames.CONDITIONAL_TRANSFER_CREATED_EVENT, async (payload) => {
      const signature = await signReceiptMessage(
        receipt,
        chainId,
        verifyingContract,
        recipientPrivateKey,
      );

      await recipient.resolveCondition({
        conditionType: ConditionalTransferTypes.SignedTransfer,
        paymentId: payload.paymentId,
        responseCID: receipt.responseCID,
        signature,
      } as PublicParams.ResolveSignedTransfer);
    });

    await performConditionalTransfer({
      conditionType: ConditionalTransferTypes.SignedTransfer,
      sender,
      chainId,
      verifyingContract,
      requestCID: receipt.requestCID,
      subgraphDeploymentID: receipt.subgraphDeploymentID,
      recipient,
      ASSET,
      TRANSFER_AMT,
    });

    // verify transfer amounts
    const finalSenderFb = await sender.getFreeBalance(ASSET);
    const finalRecipientFb = await recipient.getFreeBalance(ASSET);
    expect(finalSenderFb[sender.signerAddress]).to.be.eq(
      initialSenderFb[sender.signerAddress].sub(TRANSFER_AMT),
    );
    expect(finalRecipientFb[recipient.signerAddress]).to.be.eq(
      initialRecipientFb[recipient.signerAddress].add(TRANSFER_AMT),
    );
  });

  it("should work when clients share the same sequelize instance with a different prefix (many linked payments sent)", async () => {
    // establish tests constants
    const TRANSFER_AMT = toBN(100);
    const MIN_TRANSFERS = 25;
    const TRANSFER_INTERVAL = 1000; // ms between consecutive transfer calls

    let receivedTransfers = 0;
    let intervals = 0;
    let pollerError: string | undefined;

    // call transfers on interval
    const start = Date.now();
    const interval = setInterval(async () => {
      intervals += 1;
      if (intervals > MIN_TRANSFERS) {
        clearInterval(interval);
        return;
      }
      let error: any = undefined;
      try {
        const [, preImage] = await performConditionalTransfer({
          conditionType: ConditionalTransferTypes.LinkedTransfer,
          sender,
          recipient,
          ASSET,
          TRANSFER_AMT,
        });
        console.log(`[${intervals}/${MIN_TRANSFERS}] preImage: ${preImage}`);
      } catch (e) {
        error = e;
      }
      if (error) {
        clearInterval(interval);
        throw error;
      }
    }, TRANSFER_INTERVAL);

    // setup promise to properly wait out the transfers / stop interval
    // will also periodically check if a poller error has been set and reject
    await new Promise((resolve, reject) => {
      registerFailureListeners(reject, sender, recipient);
      // setup listeners (increment on reclaim)
      recipient.on(EventNames.CONDITIONAL_TRANSFER_UNLOCKED_EVENT, () => {
        receivedTransfers += 1;
        console.log(`[${receivedTransfers}/${MIN_TRANSFERS}] redeemed`);
        if (receivedTransfers >= MIN_TRANSFERS) {
          resolve();
        }
      });
      recipient.on(EventNames.CONDITIONAL_TRANSFER_FAILED_EVENT, reject);
      sender.on(EventNames.CONDITIONAL_TRANSFER_FAILED_EVENT, reject);

      // register a check to see if the poller has been cleared
      setInterval(() => {
        if (pollerError) {
          reject(pollerError);
        }
      }, 250);
    });
    const end = Date.now();
    console.log(
      `Average latency of ${MIN_TRANSFERS} transfers: ${(end - start) / MIN_TRANSFERS}ms`,
    );

    expect(receivedTransfers).to.be.eq(MIN_TRANSFERS);
    const finalSenderFb = await sender.getFreeBalance(ASSET);
    const finalRecipientFb = await recipient.getFreeBalance(ASSET);
    expect(finalSenderFb[sender.signerAddress]).to.be.eq(
      initialSenderFb[sender.signerAddress].sub(TRANSFER_AMT.mul(receivedTransfers)),
    );
    expect(finalRecipientFb[recipient.signerAddress]).to.be.eq(
      initialRecipientFb[recipient.signerAddress].add(TRANSFER_AMT.mul(receivedTransfers)),
    );
  });

  it("should work when clients share the same sequelize instance with a different prefix (many payments sent)", async () => {
    // establish tests constants
    const TRANSFER_AMT = toBN(100);
    const MIN_TRANSFERS = 25;
    const TRANSFER_INTERVAL = 1000; // ms between consecutive transfer calls

    let receivedTransfers = 0;
    let intervals = 0;
    let pollerError: any;

    const { chainId } = await sender.ethProvider.getNetwork();

    recipient.on(EventNames.CONDITIONAL_TRANSFER_CREATED_EVENT, async (payload) => {
      console.log(`Got signed transfer event: ${payload.paymentId}`);
      const signature = await signReceiptMessage(
        receipt,
        chainId,
        verifyingContract,
        recipientPrivateKey,
      );
      await recipient.resolveCondition({
        conditionType: ConditionalTransferTypes.SignedTransfer,
        paymentId: payload.paymentId,
        responseCID: receipt.responseCID,
        signature,
      } as PublicParams.ResolveSignedTransfer);
      console.log(`Resolved signed transfer: ${payload.paymentId}`);
    });

    // call transfers on interval
    const start = Date.now();
    const interval = setInterval(async () => {
      intervals += 1;
      if (intervals > MIN_TRANSFERS) {
        clearInterval(interval);
        return;
      }
      try {
        const paymentId = getRandomBytes32();
        console.log(`[${intervals}/${MIN_TRANSFERS}] creating transfer with ${paymentId}`);
        const transferRes = await sender.conditionalTransfer({
          amount: TRANSFER_AMT,
          paymentId,
          conditionType: ConditionalTransferTypes.SignedTransfer,
          signerAddress: recipient.signerAddress,
          chainId,
          verifyingContract,
          requestCID: receipt.requestCID,
          subgraphDeploymentID: receipt.subgraphDeploymentID,
          assetId: ASSET,
          recipient: recipient.publicIdentifier,
        } as PublicParams.SignedTransfer);
        console.log(`[${intervals}/${MIN_TRANSFERS}] senderApp: ${transferRes.appIdentityHash}`);
      } catch (e) {
        clearInterval(interval);
        throw e;
      }
    }, TRANSFER_INTERVAL);

    // setup promise to properly wait out the transfers / stop interval
    // will also periodically check if a poller error has been set and reject
    await new Promise((resolve, reject) => {
      registerFailureListeners(reject, sender, recipient);
      // setup listeners (increment on reclaim)
      recipient.on(EventNames.CONDITIONAL_TRANSFER_UNLOCKED_EVENT, async (msg) => {
        receivedTransfers += 1;
        console.log(`received ${receivedTransfers}/${MIN_TRANSFERS}: ${msg.paymentId}`);
        if (receivedTransfers >= MIN_TRANSFERS) {
          resolve();
        }
      });

      // register a check to see if the poller has been cleared
      setInterval(() => {
        if (pollerError) {
          reject(pollerError);
        }
      }, 250);
    });
    const end = Date.now();
    console.log(
      `Average latency of ${MIN_TRANSFERS} transfers: ${(end - start) / MIN_TRANSFERS}ms`,
    );

    expect(receivedTransfers).to.be.eq(MIN_TRANSFERS);
    const finalSenderFb = await sender.getFreeBalance(ASSET);
    const finalRecipientFb = await recipient.getFreeBalance(ASSET);
    expect(finalSenderFb[sender.signerAddress]).to.be.eq(
      initialSenderFb[sender.signerAddress].sub(TRANSFER_AMT.mul(receivedTransfers)),
    );
    expect(finalRecipientFb[recipient.signerAddress]).to.be.eq(
      initialRecipientFb[recipient.signerAddress].add(TRANSFER_AMT.mul(receivedTransfers)),
    );
  });
});
