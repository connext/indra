import { convertLinkedTransferParameters } from "@connext/apps";
import {
  SimpleLinkedTransferApp,
  LINKED_TRANSFER,
  SimpleLinkedTransferAppStateBigNumber,
  CreateTransferEventData,
  CREATE_TRANSFER,
} from "@connext/types";
import { encryptWithPublicKey } from "@connext/crypto";
import { HashZero, Zero } from "ethers/constants";
import { fromExtendedKey } from "ethers/utils/hdnode";

import { createLinkedHash, stringify, xpubToAddress } from "../lib";
import { CFCoreTypes, LinkedTransferParameters, LinkedTransferResponse } from "../types";
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
  public linkedTransfer = async (
    params: LinkedTransferParameters,
  ): Promise<LinkedTransferResponse> => {
    // convert params + validate
    const {
      amount,
      assetId,
      paymentId,
      preImage,
      meta,
      recipient,
    } = convertLinkedTransferParameters(`bignumber`, params);

    const freeBalance = await this.connext.getFreeBalance(assetId);
    const preTransferBal = freeBalance[this.connext.freeBalanceAddress];
    validate(
      notNegative(amount),
      invalidAddress(assetId),
      notLessThanOrEqualTo(amount, preTransferBal),
      invalid32ByteHexString(paymentId),
      invalid32ByteHexString(preImage),
    );

    if (recipient) {
      validate(invalidXpub(recipient));
    }

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
      recipient,
      meta,
      transferMeta: {},
    } as CreateTransferEventData<"LINKED_TRANSFER">;

    if (recipient) {
      // set recipient and encrypted pre-image on linked transfer
      const recipientPublicKey = fromExtendedKey(recipient).derivePath(`0`).publicKey;
      const encryptedPreImage = await encryptWithPublicKey(
        recipientPublicKey.replace(/^0x/, ``),
        preImage,
      );

      // add encrypted preImage to meta so node can store it in the DB
      params.meta["encryptedPreImage"] = encryptedPreImage;
      params.meta["recipient"] = recipient;

      eventData.transferMeta.encryptedPreImage = encryptedPreImage;

      // publish encrypted secret for receiver
      await this.connext.messaging.publish(
        `${this.connext.publicIdentifier}.channel.${this.connext.multisigAddress}.transfer.linked.to.${recipient}`,
        stringify(eventData),
      );

      // need to flush here so that the client can exit knowing that messages are in the NATS server
      await this.connext.messaging.flush();
    }
    this.connext.emit(CREATE_TRANSFER, eventData);
    return { appId, paymentId, preImage };
  };
}
