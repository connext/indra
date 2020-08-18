import { MessagingService } from "@connext/messaging";
import {
  NodeResponses,
  SimpleSignedTransferAppState,
  SimpleSignedTransferAppName,
  GraphSignedTransferAppName,
} from "@connext/types";
import { bigNumberifyJson } from "@connext/utils";
import { FactoryProvider } from "@nestjs/common/interfaces";
import { RpcException } from "@nestjs/microservices";

import { AuthService } from "../auth/auth.service";
import { LoggerService } from "../logger/logger.service";
import { MessagingProviderId, LinkedTransferProviderId } from "../constants";
import { AbstractMessagingProvider } from "../messaging/abstract.provider";
import { ConfigService } from "../config/config.service";

import { SignedTransferService } from "./signedTransfer.service";

export class SignedTransferMessaging extends AbstractMessagingProvider {
  constructor(
    private readonly authService: AuthService,
    log: LoggerService,
    messaging: MessagingService,
    private readonly configService: ConfigService,
    private readonly signedTransferService: SignedTransferService,
  ) {
    super(log, messaging);
    log.setContext("GrapgTransferMessaging");
  }

  private async getSignedTransfer(
    paymentId: string,
    chainId: number,
    name: typeof SimpleSignedTransferAppName | typeof GraphSignedTransferAppName,
  ): Promise<NodeResponses.GetSignedTransfer | undefined> {
    const {
      senderApp,
      status,
      receiverApp,
    } = await this.signedTransferService.findSenderAndReceiverAppsWithStatus(
      paymentId,
      name,
      chainId,
    );
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
      status: status!,
      meta,
    };
  }

  async getSignedTransferByPaymentId(
    pubId: string,
    chainId: number,
    data: { paymentId: string },
  ): Promise<NodeResponses.GetSignedTransfer | undefined> {
    const { paymentId } = data;
    if (!paymentId) {
      throw new RpcException(`Incorrect data received. Data: ${JSON.stringify(data)}`);
    }
    this.log.info(`Got fetch signed transfer request for: ${paymentId}`);

    // determine status
    // node receives transfer in sender app
    return this.getSignedTransfer(paymentId, chainId, SimpleSignedTransferAppName);
  }

  async getGraphTransferByPaymentId(
    pubId: string,
    chainId: number,
    data: { paymentId: string },
  ): Promise<NodeResponses.GetSignedTransfer | undefined> {
    const { paymentId } = data;
    if (!paymentId) {
      throw new RpcException(`Incorrect data received. Data: ${JSON.stringify(data)}`);
    }
    this.log.info(`Got fetch graph transfer request for: ${paymentId}`);

    // determine status
    // node receives transfer in sender app
    return this.getSignedTransfer(paymentId, chainId, GraphSignedTransferAppName);
  }

  async setupSubscriptions(): Promise<void> {
    await super.connectRequestReponse(
      `*.${this.configService.getPublicIdentifier()}.*.transfer.get-signed`,
      this.authService.parseIdentifierAndChain(this.getSignedTransferByPaymentId.bind(this)),
    );

    await super.connectRequestReponse(
      `*.${this.configService.getPublicIdentifier()}.*.transfer.get-graph`,
      this.authService.parseIdentifierAndChain(this.getGraphTransferByPaymentId.bind(this)),
    );
  }
}

export const signedTransferProviderFactory: FactoryProvider<Promise<void>> = {
  inject: [AuthService, LoggerService, MessagingProviderId, ConfigService, SignedTransferService],
  provide: LinkedTransferProviderId,
  useFactory: async (
    authService: AuthService,
    logging: LoggerService,
    messaging: MessagingService,
    configService: ConfigService,
    signedTransferService: SignedTransferService,
  ): Promise<void> => {
    const transfer = new SignedTransferMessaging(
      authService,
      logging,
      messaging,
      configService,
      signedTransferService,
    );
    await transfer.setupSubscriptions();
  },
};
