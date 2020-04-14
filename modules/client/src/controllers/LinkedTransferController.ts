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
  invalid32ByteHexString,
  invalidAddress,
  invalidPublicIdentifier,
  stringify,
  toBN,
  validate,
} from "@connext/utils";
import { HashZero, Zero } from "ethers/constants";
import { solidityKeccak256 } from "ethers/utils";

import { AbstractController } from "./AbstractController";

export class LinkedTransferController extends AbstractController {
  public linkedTransfer = async (
    params: PublicParams.LinkedTransfer,
  ): Promise<PublicResults.LinkedTransfer> => {
    const amount = toBN(params.amount);
    const {
      paymentId,
      preImage,
      meta,
      recipient,
    } = params;
    const assetId = params.assetId
      ? getAddressFromAssetId(params.assetId)
      : CONVENTION_FOR_ETH_ASSET_ID;

    validate(
      invalidAddress(assetId),
      invalid32ByteHexString(paymentId),
      invalid32ByteHexString(preImage),
    );

    const submittedMeta = { ...(meta || {}) } as any;
    
    if (recipient) {
      validate(invalidPublicIdentifier(recipient));
      // set recipient and encrypted pre-image on linked transfer
      const encryptedPreImage = await this.channelProvider.encrypt(
        preImage,
        recipient,
      );

      // add encrypted preImage to meta so node can store it in the DB
      submittedMeta.encryptedPreImage = encryptedPreImage;
      submittedMeta.recipient = recipient;
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
    } = await this.connext.getAppRegistry({
      name: SimpleLinkedTransferAppName,
      chainId: network.chainId,
    }) as DefaultApp;
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
