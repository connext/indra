import {
  convertLinkedTransferToRecipientParameters,
  convertLinkedTransferParameters,
} from "@connext/apps";
import {
  SimpleLinkedTransferApp,
  LINKED_TRANSFER,
  LINKED_TRANSFER_TO_RECIPIENT,
  SimpleLinkedTransferAppStateBigNumber,
  CreateTransferEventData,
  CREATE_TRANSFER,
} from "@connext/types";
import { encryptWithPublicKey } from "@connext/crypto";
import { HashZero, Zero } from "ethers/constants";
import { fromExtendedKey } from "ethers/utils/hdnode";

import { createLinkedHash, stringify, xpubToAddress } from "../lib";
import {
  CFCoreTypes,
  LinkedTransferParameters,
  LinkedTransferResponse,
  LinkedTransferToRecipientParameters,
  LinkedTransferToRecipientResponse,
} from "../types";
import {
  invalid32ByteHexString,
  invalidAddress,
  invalidXpub,
  notLessThanOrEqualTo,
  notNegative,
  validate,
} from "../validation";

import { AbstractController } from "./AbstractController";

export class LinkedTransferController extends AbstractController {
  public linkedTransferToRecipient = async (
    params: LinkedTransferToRecipientParameters,
  ): Promise<LinkedTransferToRecipientResponse> => {
    params.meta = params.meta && typeof params.meta === "object" ? params.meta : {};
    const {
      amount,
      assetId,
      paymentId,
      preImage,
      recipient,
      meta,
    } = convertLinkedTransferToRecipientParameters(`bignumber`, params);

    validate(invalidXpub(recipient));

    // set recipient and encrypted pre-image on linked transfer
    // TODO: use app path instead?
    const recipientPublicKey = fromExtendedKey(recipient).derivePath(`0`).publicKey;
    const encryptedPreImage = await encryptWithPublicKey(
      recipientPublicKey.replace(/^0x/, ``),
      preImage,
    );

    // add encrypted preImage to meta so node can store it in the DB
    params.meta["encryptedPreImage"] = encryptedPreImage;
    params.meta["recipient"] = recipient;

    // wait for linked transfer (2562 ms)
    const ret = await this.linkedTransfer({
      ...params,
      conditionType: LINKED_TRANSFER,
    });

    const eventData = {
      type: LINKED_TRANSFER_TO_RECIPIENT,
      amount: amount.toString(),
      assetId,
      paymentId,
      sender: this.connext.publicIdentifier,
      recipient,
      meta,
      transferMeta: {
        encryptedPreImage,
      },
    } as CreateTransferEventData<typeof LINKED_TRANSFER_TO_RECIPIENT>;
    // publish encrypted secret for receiver
    await this.connext.messaging.publish(
      `transfer.send-async.${recipient}`,
      stringify({ ...eventData, encryptedPreImage }),
    );

    this.connext.emit(CREATE_TRANSFER, eventData);

    // need to flush here so that the client can exit knowing that messages are in the NATS server
    await this.connext.messaging.flush();

    return { ...ret, recipient };
  };

  public linkedTransfer = async (
    params: LinkedTransferParameters,
  ): Promise<LinkedTransferResponse> => {
    // convert params + validate
    const { amount, assetId, paymentId, preImage, meta } = convertLinkedTransferParameters(
      `bignumber`,
      params,
    );

    const freeBalance = await this.connext.getFreeBalance(assetId);
    const preTransferBal = freeBalance[this.connext.freeBalanceAddress];
    validate(
      notNegative(amount),
      invalidAddress(assetId),
      notLessThanOrEqualTo(amount, preTransferBal),
      invalid32ByteHexString(paymentId),
      invalid32ByteHexString(preImage),
    );

    // install the transfer application
    const linkedHash = createLinkedHash(amount, assetId, paymentId, preImage);

    const initialState: SimpleLinkedTransferAppStateBigNumber = {
      amount,
      assetId,
      coinTransfers: [
        {
          amount,
          to: xpubToAddress(this.connext.publicIdentifier),
        },
        {
          amount: Zero,
          to: xpubToAddress(this.connext.nodePublicIdentifier),
        },
      ],
      linkedHash,
      paymentId,
      preImage: HashZero,
    };

    const {
      actionEncoding,
      stateEncoding,
      appDefinitionAddress: appDefinition,
      outcomeType,
    } = this.connext.getRegisteredAppDetails(SimpleLinkedTransferApp);
    const proposeInstallParams: CFCoreTypes.ProposeInstallParams = {
      abiEncodings: {
        actionEncoding,
        stateEncoding,
      },
      appDefinition,
      initialState,
      initiatorDeposit: amount,
      initiatorDepositTokenAddress: assetId,
      meta,
      outcomeType,
      proposedToIdentifier: this.connext.nodePublicIdentifier,
      responderDeposit: Zero,
      responderDepositTokenAddress: assetId,
      timeout: Zero,
    };
    const appId = await this.proposeAndInstallLedgerApp(proposeInstallParams);

    if (!appId) {
      throw new Error(`App was not installed`);
    }

    const eventData = {
      type: LINKED_TRANSFER,
      amount: amount.toString(),
      assetId,
      paymentId,
      sender: this.connext.publicIdentifier,
      meta,
      transferMeta: {},
    } as CreateTransferEventData<typeof LINKED_TRANSFER>;
    this.connext.emit(CREATE_TRANSFER, eventData);

    return {
      paymentId,
      preImage,
    };
  };
}
