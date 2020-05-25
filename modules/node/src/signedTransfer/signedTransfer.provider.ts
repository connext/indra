import { MessagingService } from "@connext/messaging";
import {
  NodeResponses,
  SimpleSignedTransferAppState,
  SimpleSignedTransferAppName,
} from "@connext/types";
import { bigNumberifyJson } from "@connext/utils";
import { FactoryProvider } from "@nestjs/common/interfaces";
import { RpcException } from "@nestjs/microservices";

import { AuthService } from "../auth/auth.service";
import { LoggerService } from "../logger/logger.service";
import { MessagingProviderId, LinkedTransferProviderId } from "../constants";
import { AbstractMessagingProvider } from "../messaging/abstract.provider";

import { SignedTransferService } from "./signedTransfer.service";

export class SignedTransferMessaging extends AbstractMessagingProvider {
  constructor(
    private readonly authService: AuthService,
    log: LoggerService,
    messaging: MessagingService,
    private readonly signedTransferService: SignedTransferService,
  ) {
    super(log, messaging);
    log.setContext("LinkedTransferMessaging");
  }

  async getSignedTransferByPaymentId(
    pubId: string,
    data: { paymentId: string },
  ): Promise<NodeResponses.GetSignedTransfer> {
    const { paymentId } = data;
    if (!paymentId) {
      throw new RpcException(`Incorrect data received. Data: ${JSON.stringify(data)}`);
    }
    this.log.info(`Got fetch signed transfer request for: ${paymentId}`);

    // determine status
    // node receives transfer in sender app
    const {
      senderApp,
      status,
      receiverApp,
    } = await this.signedTransferService.findSenderAndReceiverAppsWithStatus(paymentId);
    if (!senderApp) {
      return undefined;
    }

    const latestState = bigNumberifyJson(senderApp.latestState) as SimpleSignedTransferAppState;
    const { encryptedPreImage, recipient, ...meta } = senderApp.meta || ({} as any);
    const amount = latestState.coinTransfers[0].amount.isZero()
      ? latestState.coinTransfers[1].amount
      : latestState.coinTransfers[0].amount;
    return {
      receiverIdentifier: receiverApp ? receiverApp.responderIdentifier : undefined,
      senderIdentifier: senderApp.initiatorIdentifier,
      assetId: senderApp.initiatorDepositAssetId,
      amount: amount.toString(),
      paymentId,
      status,
      meta,
    };
  }

  async setupSubscriptions(): Promise<void> {
    await super.connectRequestReponse(
      "*.transfer.get-signed",
      this.authService.parseIdentifier(this.getSignedTransferByPaymentId.bind(this)),
    );
  }
}

export const signedTransferProviderFactory: FactoryProvider<Promise<void>> = {
  inject: [AuthService, LoggerService, MessagingProviderId, SignedTransferService],
  provide: LinkedTransferProviderId,
  useFactory: async (
    authService: AuthService,
    logging: LoggerService,
    messaging: MessagingService,
    signedTransferService: SignedTransferService,
  ): Promise<void> => {
    const transfer = new SignedTransferMessaging(
      authService,
      logging,
      messaging,
      signedTransferService,
    );
    await transfer.setupSubscriptions();
  },
};
