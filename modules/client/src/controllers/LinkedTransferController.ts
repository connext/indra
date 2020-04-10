import { DEFAULT_APP_TIMEOUT, LINKED_TRANSFER_STATE_TIMEOUT } from "@connext/apps";
import {
  isValidPublicIdentifier,
  ConditionalTransferTypes,
  CreatedLinkedTransferMeta,
  deBigNumberifyJson,
  EventNames,
  EventPayloads,
  MethodParams,
  PublicParams,
  PublicResults,
  parsePublicIdentifier,
  SimpleLinkedTransferAppName,
  SimpleLinkedTransferAppState,
  toBN,
} from "@connext/types";
import { HashZero, Zero } from "ethers/constants";

import { createLinkedHash, stringify } from "../lib";

import { AbstractController } from "./AbstractController";

export class LinkedTransferController extends AbstractController {
  public linkedTransfer = async (
    params: PublicParams.LinkedTransfer,
  ): Promise<PublicResults.LinkedTransfer> => {
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
      if (!isValidPublicIdentifier(recipient)) {
        throw new Error(`Invalid recipient identifier: ${recipient}`);
      }
      // set recipient and encrypted pre-image on linked transfer
      const encryptedPreImage = await this.signer.encrypt(
        preImage,
        parsePublicIdentifier(recipient).publicKey,
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
          to: this.connext.signerAddress,
        },
        {
          amount: Zero,
          to: this.connext.nodeSignerAddress,
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
      initiatorDepositAssetId: assetId,
      meta: submittedMeta,
      outcomeType,
      responderIdentifier: this.connext.nodeIdentifier,
      responderDeposit: Zero,
      responderDepositAssetId: assetId,
      defaultTimeout: DEFAULT_APP_TIMEOUT,
      stateTimeout: LINKED_TRANSFER_STATE_TIMEOUT,
    };
    const appIdentityHash = await this.proposeAndInstallLedgerApp(proposeInstallParams);

    if (!appIdentityHash) {
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
    return { appIdentityHash, paymentId, preImage };
  };
}
