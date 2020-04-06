import {
  ConditionalTransferTypes,
  CreatedLinkedTransferMeta,
  deBigNumberifyJson,
  EventNames,
  EventPayloads,
  LinkedTransferParameters,
  LinkedTransferResponse,
  MethodParams,
  SimpleLinkedTransferAppName,
  SimpleLinkedTransferAppState,
  toBN,
} from "@connext/types";
import { DEFAULT_APP_TIMEOUT, LINKED_TRANSFER_STATE_TIMEOUT } from "@connext/apps";
import { encryptWithPublicKey } from "@connext/crypto";
import { HashZero, Zero } from "ethers/constants";
import { fromExtendedKey } from "ethers/utils/hdnode";

import { createLinkedHash, stringify } from "../lib";
import {
  invalidXpub,
  validate,
} from "../validation";

import { AbstractController } from "./AbstractController";

export class LinkedTransferController extends AbstractController {
  public linkedTransfer = async (
    params: LinkedTransferParameters,
  ): Promise<LinkedTransferResponse> => {
    const amount = toBN(params.amount);
    const {
      assetId,
      paymentId,
      preImage,
      meta,
      recipient,
    } = params;

    const submittedMeta = { ...(meta || {}) } as CreatedLinkedTransferMeta;
    
    if (recipient) {
      validate(invalidXpub(recipient));
      // set recipient and encrypted pre-image on linked transfer
      const recipientPublicKey = fromExtendedKey(recipient).derivePath(`0`).publicKey;
      const encryptedPreImage = await encryptWithPublicKey(
        recipientPublicKey.replace(/^0x/, ``),
        preImage,
      );

      // add encrypted preImage to meta so node can store it in the DB
      submittedMeta["encryptedPreImage"] = encryptedPreImage;
      submittedMeta["recipient"] = recipient;
    }

    // install the transfer application
    const linkedHash = createLinkedHash(amount, assetId, paymentId, preImage);

    const initialState: SimpleLinkedTransferAppState = {
      amount,
      assetId,
      coinTransfers: [
        {
          amount,
          to: this.connext.freeBalanceAddress,
        },
        {
          amount: Zero,
          to: this.connext.nodeFreeBalanceAddress,
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
      meta: submittedMeta,
      outcomeType,
      proposedToIdentifier: this.connext.nodePublicIdentifier,
      responderDeposit: Zero,
      responderDepositTokenAddress: assetId,
      defaultTimeout: DEFAULT_APP_TIMEOUT,
      stateTimeout: LINKED_TRANSFER_STATE_TIMEOUT,
    };
    const appId = await this.proposeAndInstallLedgerApp(proposeInstallParams);

    if (!appId) {
      throw new Error(`App was not installed`);
    }

    const eventData = deBigNumberifyJson({
      type: ConditionalTransferTypes.LinkedTransfer,
      amount,
      assetId,
      paymentId,
      sender: this.connext.publicIdentifier,
      recipient,
      meta,
      transferMeta: {},
    }) as EventPayloads.LinkedTransferCreated;

    this.log.info(`Emitting event data: ${JSON.stringify(eventData)}`);

    if (recipient) {
      eventData.transferMeta.encryptedPreImage = submittedMeta.encryptedPreImage;

      // publish encrypted secret for receiver
      await this.connext.messaging.publish(
        `${this.connext.publicIdentifier}.channel.${this.connext.multisigAddress}.transfer.linked.to.${recipient}`,
        stringify(eventData),
      );

      // need to flush here so that the client can exit knowing that messages are in the NATS server
      await this.connext.messaging.flush();
    }
    this.connext.emit(EventNames.CONDITIONAL_TRANSFER_CREATED_EVENT, eventData);
    return { appId, paymentId, preImage };
  };
}
