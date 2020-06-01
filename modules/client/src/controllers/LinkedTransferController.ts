import { DEFAULT_APP_TIMEOUT, LINKED_TRANSFER_STATE_TIMEOUT } from "@connext/apps";
import {
  ConditionalTransferTypes,
  EventNames,
  EventPayloads,
  MethodParams,
  PublicParams,
  PublicResults,
  SimpleLinkedTransferAppName,
  SimpleLinkedTransferAppState,
  DefaultApp,
} from "@connext/types";
import {
  getBytes32Error,
  getAddressError,
  getPublicIdentifierError,
  stringify,
  toBN,
} from "@connext/utils";
import { HashZero, Zero } from "ethers/constants";
import { soliditySha256 } from "ethers/utils";

import { AbstractController } from "./AbstractController";

export class LinkedTransferController extends AbstractController {
  public linkedTransfer = async (
    params: PublicParams.LinkedTransfer,
  ): Promise<PublicResults.LinkedTransfer> => {
    this.log.info(`linkedTransfer started: ${stringify(params)}`);
    const amount = toBN(params.amount);
    const { paymentId, preImage, meta, recipient, assetId } = params;

    this.throwIfAny(
      getAddressError(assetId),
      getBytes32Error(paymentId),
      getBytes32Error(preImage),
    );

    const submittedMeta = { ...(meta || {}) } as any;

    if (recipient) {
      this.throwIfAny(getPublicIdentifierError(recipient));
      // set recipient and encrypted pre-image on linked transfer
      const encryptedPreImage = await this.channelProvider.encrypt(preImage, recipient);

      // add encrypted preImage to meta so node can store it in the DB
      submittedMeta.encryptedPreImage = encryptedPreImage;
      submittedMeta.recipient = recipient;
      submittedMeta.sender = this.connext.publicIdentifier;
    }

    submittedMeta.paymentId = paymentId;

    const linkedHash = soliditySha256(["bytes32"], [preImage]);

    const initialState: SimpleLinkedTransferAppState = {
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
      preImage: HashZero,
      finalized: false
    };

    const network = await this.ethProvider.getNetwork();
    const {
      actionEncoding,
      appDefinitionAddress: appDefinition,
      stateEncoding,
      outcomeType,
    } = (await this.connext.getAppRegistry({
      name: SimpleLinkedTransferAppName,
      chainId: network.chainId,
    })) as DefaultApp;
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
      multisigAddress: this.connext.multisigAddress,
      outcomeType,
      responderIdentifier: this.connext.nodeIdentifier,
      responderDeposit: Zero,
      responderDepositAssetId: assetId,
      defaultTimeout: DEFAULT_APP_TIMEOUT,
      stateTimeout: LINKED_TRANSFER_STATE_TIMEOUT,
    };
    this.log.debug(`Installing linked transfer app`);
    const appIdentityHash = await this.proposeAndInstallLedgerApp(proposeInstallParams);

    if (!appIdentityHash) {
      throw new Error(`App was not installed`);
    }
    this.log.debug(`Installed: ${appIdentityHash}`);

    const eventData = {
      type: ConditionalTransferTypes.LinkedTransfer,
      amount,
      assetId,
      paymentId,
      sender: this.connext.publicIdentifier,
      recipient,
      meta: submittedMeta,
      transferMeta: {},
    } as EventPayloads.LinkedTransferCreated;

    this.log.debug(`Emitting event data: ${JSON.stringify(eventData)}`);

    if (recipient) {
      this.log.debug(`Sending transfer information to ${recipient}`);
      eventData.transferMeta.encryptedPreImage = submittedMeta.encryptedPreImage;

      // publish encrypted secret for receiver
      await this.connext.node.messaging.publish(
        `${this.connext.publicIdentifier}.channel.${this.connext.multisigAddress}.transfer.linked.to.${recipient}`,
        stringify(eventData),
      );

      // need to flush here so that the client can exit knowing that messages are in the NATS server
      await this.connext.node.messaging.flush();
    }
    this.connext.emit(EventNames.CONDITIONAL_TRANSFER_CREATED_EVENT, eventData);

    const result: PublicResults.LinkedTransfer = { appIdentityHash, paymentId, preImage };
    this.log.info(`linkedTransfer for paymentId ${paymentId} complete: ${stringify(result)}`);
    return result;
  };
}
