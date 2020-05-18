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
  CONVENTION_FOR_ETH_ASSET_ID,
} from "@connext/types";
import {
  getAddressFromAssetId,
  getBytes32Error,
  getAddressError,
  getPublicIdentifierError,
  stringify,
} from "@connext/utils";
import { utils, constants, BigNumber } from "ethers";

import { AbstractController } from "./AbstractController";

const { solidityKeccak256 } = utils;
const { Zero, HashZero } = constants;

export class LinkedTransferController extends AbstractController {
  public linkedTransfer = async (
    params: PublicParams.LinkedTransfer,
  ): Promise<PublicResults.LinkedTransfer> => {
    this.log.info(`linkedTransfer started: ${stringify(params)}`);
    const amount = BigNumber.from(params.amount);
    const { paymentId, preImage, meta, recipient } = params;
    const assetId = params.assetId
      ? getAddressFromAssetId(params.assetId)
      : CONVENTION_FOR_ETH_ASSET_ID;

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

    const linkedHash = solidityKeccak256(
      ["uint256", "address", "bytes32", "bytes32"],
      [amount, assetId, paymentId, preImage],
    );

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
      outcomeType,
      responderIdentifier: this.connext.nodeIdentifier,
      responderDeposit: Zero,
      responderDepositAssetId: assetId,
      defaultTimeout: DEFAULT_APP_TIMEOUT,
      stateTimeout: LINKED_TRANSFER_STATE_TIMEOUT,
    };
    this.log.debug(`Installing linked transfer app`);
    const appIdentityHash = await this.proposeAndInstallLedgerApp(proposeInstallParams);
    this.log.debug(`Installed: ${appIdentityHash}`);

    if (!appIdentityHash) {
      throw new Error(`App was not installed`);
    }

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
