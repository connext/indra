import {
  EventNames,
  CreateTransferEventData,
  ConditionalTransferTypes,
  MethodParams,
  SimpleLinkedTransferAppName,
  SimpleLinkedTransferAppState,
  toBN,
} from "@connext/types";
import { encryptWithPublicKey } from "@connext/crypto";
import { HashZero, Zero } from "ethers/constants";
import { fromExtendedKey } from "ethers/utils/hdnode";

import { createLinkedHash, stringify, xpubToAddress } from "../lib";
import {
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
    const amount = toBN(params.amount);
    const {
      assetId,
      paymentId,
      preImage,
      recipient,
      meta,
    } = params;

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
      conditionType: ConditionalTransferTypes.LinkedTransfer,
    });

    const eventData = {
      type: ConditionalTransferTypes.LinkedTransferToRecipient,
      amount,
      assetId,
      paymentId,
      sender: this.connext.publicIdentifier,
      recipient,
      meta,
      transferMeta: {
        encryptedPreImage,
      },
    } as CreateTransferEventData<typeof ConditionalTransferTypes.LinkedTransferToRecipient>;
    // publish encrypted secret for receiver
    await this.connext.messaging.publish(
      `transfer.send-async.${recipient}`,
      stringify({ ...eventData, encryptedPreImage }),
    );

    this.connext.emit(EventNames.CREATE_TRANSFER, eventData);

    // need to flush here so that the client can exit knowing that messages are in the NATS server
    await this.connext.messaging.flush();

    return { ...ret, recipient };
  };

  public linkedTransfer = async (
    params: LinkedTransferParameters,
  ): Promise<LinkedTransferResponse> => {
    const amount = toBN(params.amount);
    const { assetId, paymentId, preImage, meta } = params;

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

    const initialState: SimpleLinkedTransferAppState = {
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
    } = this.connext.getRegisteredAppDetails(SimpleLinkedTransferAppName);
    const proposeInstallParams: MethodParams.ProposeInstall = {
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
      type: ConditionalTransferTypes.LinkedTransfer,
      amount,
      assetId,
      paymentId,
      sender: this.connext.publicIdentifier,
      meta,
      transferMeta: {},
    } as CreateTransferEventData<typeof ConditionalTransferTypes.LinkedTransfer>;
    this.connext.emit(EventNames.CREATE_TRANSFER, eventData);

    return {
      paymentId,
      preImage,
    };
  };
}
