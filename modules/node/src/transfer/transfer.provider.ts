import { MessagingService } from "@connext/messaging";
import {
  NodeResponses,
  SimpleLinkedTransferAppName,
  SimpleSignedTransferAppName,
} from "@connext/types";
import { FactoryProvider } from "@nestjs/common/interfaces";

import { AuthService } from "../auth/auth.service";
import { LoggerService } from "../logger/logger.service";
import { MessagingProviderId, TransferProviderId } from "../constants";
import { AbstractMessagingProvider } from "../messaging/abstract.provider";
import { LinkedTransferService } from "../linkedTransfer/linkedTransfer.service";
import { RpcException } from "@nestjs/microservices";
import { stringify } from "@connext/utils";
import { TransferService } from "./transfer.service";

export class TransferMessaging extends AbstractMessagingProvider {
  constructor(
    private readonly authService: AuthService,
    log: LoggerService,
    messaging: MessagingService,
    private readonly linkedTransferService: LinkedTransferService,
    private readonly transferService: TransferService,
  ) {
    super(log, messaging);
    this.log.setContext("TransferMessaging");
  }

  async getTransferHistory(pubId: string): Promise<NodeResponses.GetTransferHistory> {
    throw new Error("Unimplemented");
  }

  /**
   * Check in endpoint for client to call when it comes online to handle pending tasks
   * @param userIdentifier
   */
  async clientCheckIn(userIdentifier: string): Promise<void> {
    // reclaim collateral from redeemed transfers
    await this.linkedTransferService.unlockLinkedTransfersFromUser(userIdentifier);
  }

  async resolveLinkedTransfer(
    pubId: string,
    { paymentId }: { paymentId: string },
  ): Promise<NodeResponses.ResolveLinkedTransfer> {
    this.log.debug(`Got resolve link request with data: ${stringify(paymentId)}`);
    if (!paymentId) {
      throw new RpcException(`Incorrect data received. Data: ${JSON.stringify(paymentId)}`);
    }

    const response = await this.transferService.resolveByPaymentId(
      pubId,
      paymentId,
      SimpleLinkedTransferAppName,
    );
    return {
      ...response,
      amount: response.amount,
    };
  }

  async resolveSignedTransfer(
    pubId: string,
    data: { paymentId: string },
  ): Promise<NodeResponses.ResolveSignedTransfer> {
    if (!data.paymentId) {
      throw new RpcException(`Incorrect data received. Data: ${JSON.stringify(data)}`);
    }
    this.log.info(`Got resolve signed transfer request with paymentId: ${data.paymentId}`);

    const response = await this.transferService.resolveByPaymentId(
      pubId,
      data.paymentId,
      SimpleSignedTransferAppName,
    );
    return {
      ...response,
      amount: response.amount,
    };
  }

  async setupSubscriptions(): Promise<void> {
    await super.connectRequestReponse(
      "*.transfer.get-history",
      this.authService.parseIdentifier(this.getTransferHistory.bind(this)),
    );

    await super.connectRequestReponse(
      "*.transfer.install-linked",
      this.authService.parseIdentifier(this.resolveLinkedTransfer.bind(this)),
    );

    await super.connectRequestReponse(
      "*.transfer.install-signed",
      this.authService.parseIdentifier(this.resolveSignedTransfer.bind(this)),
    );

    await super.connectRequestReponse(
      "*.client.check-in",
      this.authService.parseIdentifier(this.clientCheckIn.bind(this)),
    );
  }
}

export const transferProviderFactory: FactoryProvider<Promise<void>> = {
  inject: [AuthService, LoggerService, MessagingProviderId, LinkedTransferService, TransferService],
  provide: TransferProviderId,
  useFactory: async (
    authService: AuthService,
    logging: LoggerService,
    messaging: MessagingService,
    linkedTransferService: LinkedTransferService,
    transferService: TransferService,
  ): Promise<void> => {
    const transfer = new TransferMessaging(
      authService,
      logging,
      messaging,
      linkedTransferService,
      transferService,
    );
    await transfer.setupSubscriptions();
  },
};
