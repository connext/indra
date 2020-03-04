import { SimpleLinkedTransferApp } from "@connext/apps";
import {
  RECEIVE_TRANSFER_FAILED_EVENT,
  RECEIVE_TRANSFER_FINISHED_EVENT,
  RECEIVE_TRANSFER_STARTED_EVENT,
  RECIEVE_TRANSFER_FAILED_EVENT,
  RECIEVE_TRANSFER_FINISHED_EVENT,
  RECIEVE_TRANSFER_STARTED_EVENT,
  ReceiveTransferFinishedEventData,
  CFCoreTypes,
  SimpleLinkedTransferAppStateBigNumber,
} from "@connext/types";
import { AddressZero, HashZero, Zero } from "ethers/constants";
import { bigNumberify, formatEther } from "ethers/utils";

import { createLinkedHash, xpubToAddress } from "../lib";
import { ResolveLinkedTransferParameters, ResolveLinkedTransferResponse } from "../types";
import { invalid32ByteHexString, invalidAddress, notNegative, validate } from "../validation";

import { AbstractController } from "./AbstractController";

export class ResolveLinkedTransferController extends AbstractController {
  // properly logs error and emits a receive transfer failed event
  private handleResolveErr = (paymentId: string, e: any): void => {
    this.log.error(`Failed to resolve linked transfer ${paymentId}: ${e.stack || e.message}`);
    this.connext.emit(RECEIVE_TRANSFER_FAILED_EVENT, {
      error: e.stack || e.message,
      paymentId,
    });

    // TODO: remove when deprecated
    this.connext.emit(RECIEVE_TRANSFER_FAILED_EVENT, {
      message: `This event has been deprecated in favor of ${RECEIVE_TRANSFER_FAILED_EVENT}`,
      paymentId,
    });
  };

  public resolveLinkedTransfer = async (
    params: ResolveLinkedTransferParameters,
  ): Promise<ResolveLinkedTransferResponse> => {
    const { assetId, amount, meta, senderPublicIdentifier } = await this.node.fetchLinkedTransfer(
      params.paymentId,
    );
    // convert and validate
    // because this function is only used internally, it is safe to add
    // the amount / assetId to the api params without breaking interfaces
    const { paymentId, preImage } = params;
    validate(
      notNegative(amount),
      invalidAddress(assetId),
      invalid32ByteHexString(paymentId),
      invalid32ByteHexString(preImage),
    );
    const amountBN = bigNumberify(amount);

    this.log.info(
      `Resolving link transfer of ${formatEther(amount)} ${
        assetId === AddressZero ? "ETH" : "Tokens"
      } with id ${params.paymentId}`,
    );

    this.connext.emit(RECEIVE_TRANSFER_STARTED_EVENT, {
      paymentId,
    });

    // TODO: remove when deprecated
    this.connext.emit(RECIEVE_TRANSFER_STARTED_EVENT, {
      message: `This event has been deprecated in favor of ${RECEIVE_TRANSFER_STARTED_EVENT}`,
      paymentId,
    });

    // install app and take action
    const {
      actionEncoding,
      stateEncoding,
      appDefinitionAddress: appDefinition,
      outcomeType,
    } = this.connext.getRegisteredAppDetails(SimpleLinkedTransferApp);

    const initialState: SimpleLinkedTransferAppStateBigNumber = {
      amount: amountBN,
      assetId,
      coinTransfers: [
        {
          amount: amountBN,
          to: xpubToAddress(this.connext.nodePublicIdentifier),
        },
        {
          amount: Zero,
          to: xpubToAddress(this.connext.publicIdentifier),
        },
      ],
      linkedHash: createLinkedHash(amountBN, assetId, paymentId, preImage),
      paymentId,
      preImage: HashZero,
    };

    let appId: string;
    const proposeInstallParams: CFCoreTypes.ProposeInstallParams = {
      abiEncodings: {
        actionEncoding,
        stateEncoding,
      },
      appDefinition,
      initialState,
      initiatorDeposit: Zero,
      initiatorDepositTokenAddress: assetId,
      outcomeType,
      proposedToIdentifier: this.connext.nodePublicIdentifier,
      responderDeposit: amountBN,
      responderDepositTokenAddress: assetId,
      timeout: Zero,
    };
    try {
      appId = await this.proposeAndInstallLedgerApp(proposeInstallParams);
      await this.connext.takeAction(appId, { preImage });
      await this.connext.uninstallApp(appId);
    } catch (e) {
      this.handleResolveErr(paymentId, e);
      throw e;
    }

    this.connext.emit(RECEIVE_TRANSFER_FINISHED_EVENT, {
      amount: amount.toString(),
      appId,
      assetId,
      meta,
      paymentId,
      sender: senderPublicIdentifier,
    } as ReceiveTransferFinishedEventData);

    // TODO: remove when deprecated
    this.connext.emit(RECIEVE_TRANSFER_FINISHED_EVENT, {
      message: `This event has been deprecated in favor of ${RECEIVE_TRANSFER_FINISHED_EVENT}`,
      paymentId,
    });

    return {
      appId,
      sender: senderPublicIdentifier,
      paymentId,
      meta,
    };
  };
}
