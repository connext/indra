import {
  Address,
  Bytes32,
  ConditionalTransferTypes,
  CONVENTION_FOR_ETH_ASSET_ID,
  EventNames,
  GraphReceipt,
  IConnextClient,
  PublicParams,
} from "@connext/types";
import { getFileStore } from "@connext/store";
import { ConnextClient } from "@connext/client";
import {
  ChannelSigner,
  getRandomBytes32,
  getRandomPrivateKey,
  getTestGraphReceiptToSign,
  getTestVerifyingContract,
  signGraphReceiptMessage,
  toBN,
} from "@connext/utils";
import { Sequelize, Transaction } from "sequelize";
import { BigNumber } from "ethers";

import {
  createClient,
  env,
  ETH_AMOUNT_MD,
  ethProviderUrl,
  expect,
  fundChannel,
  getTestLoggers,
} from "../util";

// NOTE: group correct number of promises associated with a payment.
// there is no validation done to ensure the events correspond to the payments,
// or to ensure that the event payloads are correct.

/*
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
*/

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
  const receipt = getTestGraphReceiptToSign();
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
    case ConditionalTransferTypes.GraphTransfer: {
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
    case ConditionalTransferTypes.SignedTransfer: {
      throw new Error(`Test util not yet configured for signed transfer`);
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

const name = "Multichannel Store";
const { timeElapsed } = getTestLoggers(name);
describe(name, () => {
  let chainId: number;
  let initialRecipientFb: { [x: string]: BigNumber };
  let initialSenderFb: { [x: string]: string | BigNumber };
  let receipt: GraphReceipt;
  let recipient: ConnextClient;
  let recipientKey: string;
  let recipientSigner: ChannelSigner;
  let sender: ConnextClient;
  let senderKey: string;
  let senderSigner: ChannelSigner;
  let start: number;
  let verifyingContract: Address;

  const DEPOSIT_AMT = ETH_AMOUNT_MD;
  const ASSET = CONVENTION_FOR_ETH_ASSET_ID;

  beforeEach(async () => {
    start = Date.now();
    senderKey = getRandomPrivateKey();
    recipientKey = getRandomPrivateKey();
    senderSigner = new ChannelSigner(senderKey, ethProviderUrl);
    recipientSigner = new ChannelSigner(recipientKey, ethProviderUrl);
    const sequelize = new Sequelize({
      dialect: "sqlite",
      storage: `${env.storeDir}/store.sqlite`,
      isolationLevel: Transaction.ISOLATION_LEVELS.READ_UNCOMMITTED,
      logging: false,
    });
    // create stores with same sequelize instance but with different prefixes
    const senderStore = getFileStore(
      env.storeDir,
      { sequelize, prefix: senderSigner.publicIdentifier },
    );
    const recipientStore = getFileStore(
      env.storeDir,
      { sequelize, prefix: recipientSigner.publicIdentifier },
    );
    // create clients with shared store
    sender = (await createClient({
      signer: senderSigner,
      store: senderStore,
      id: "S",
    })) as ConnextClient;
    recipient = (await createClient({
      signer: recipientSigner,
      store: recipientStore,
      id: "R",
    })) as ConnextClient;
    timeElapsed("Created both clients", start);
    receipt = getTestGraphReceiptToSign();
    chainId = (await sender.ethProvider.getNetwork()).chainId;
    verifyingContract = getTestVerifyingContract();
    await fundChannel(sender, DEPOSIT_AMT, ASSET);
    initialSenderFb = await sender.getFreeBalance(ASSET);
    initialRecipientFb = await recipient.getFreeBalance(ASSET);
    timeElapsed("beforeEach complete", start);
  });

  afterEach(async () => {
    await sender.off();
    await recipient.off();
    await sender.store.clear();
    await recipient.store.clear();
  });

  it("Linked transfers should work w clients sharing a sequelize instance", async () => {
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

  it("Graph transfers should work w clients sharing a sequelize instance", async () => {
    // establish tests constants
    const TRANSFER_AMT = toBN(100);

    // register listener to resolve payment
    recipient.once(EventNames.CONDITIONAL_TRANSFER_CREATED_EVENT, async (payload) => {
      const signature = await signGraphReceiptMessage(
        receipt,
        chainId,
        verifyingContract,
        recipientKey,
      );
      await recipient.resolveCondition({
        conditionType: ConditionalTransferTypes.GraphTransfer,
        paymentId: payload.paymentId,
        responseCID: receipt.responseCID,
        signature,
      } as PublicParams.ResolveGraphTransfer);
    });

    await performConditionalTransfer({
      conditionType: ConditionalTransferTypes.GraphTransfer,
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

});
