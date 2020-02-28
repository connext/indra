import { IMessagingService } from "@connext/messaging";
import { ResolveLinkedTransferResponse, Transfer } from "@connext/types";
import { FactoryProvider } from "@nestjs/common/interfaces";
import { RpcException } from "@nestjs/microservices";

import { AuthService } from "../auth/auth.service";
import { LoggerService } from "../logger/logger.service";
import { MessagingProviderId, TransferProviderId } from "../constants";
import { AbstractMessagingProvider, replaceBN } from "../util";

import { LinkedTransfer } from "./transfer.entity";
import { TransferService } from "./transfer.service";

export class TransferMessaging extends AbstractMessagingProvider {
  constructor(
    private readonly authService: AuthService,
    log: LoggerService,
    messaging: IMessagingService,
    private readonly transferService: TransferService,
  ) {
    super(log, messaging);
    this.log.setContext("TransferMessaging");
  }

  async getLinkedTransferByPaymentId(
    pubId: string,
    data: { paymentId: string },
  ): Promise<Transfer> {
    if (!data.paymentId) {
      throw new RpcException(`Incorrect data received. Data: ${JSON.stringify(data)}`);
    }
    this.log.info(`Got fetch link request for: ${data.paymentId}`);
    return await this.transferService.getTransferByPaymentId(data.paymentId);
  }

  async resolveLinkedTransfer(
    pubId: string,
    data: { paymentId: string; linkedHash: string },
  ): Promise<ResolveLinkedTransferResponse> {
    this.log.debug(`Got resolve link request with data: ${JSON.stringify(data, replaceBN, 2)}`);
    const { paymentId, linkedHash } = data;
    if (!paymentId || !linkedHash) {
      throw new RpcException(`Incorrect data received. Data: ${JSON.stringify(data)}`);
    }
    return await this.transferService.resolveLinkedTransfer(pubId, paymentId, linkedHash);
  }

  // DEPRECATED
  async setRecipientOnLinkedTransfer(
    pubId: string,
    data: {
      recipientPublicIdentifier: string;
      linkedHash: string;
      encryptedPreImage: string;
    },
  ): Promise<{ linkedHash: string }> {
    const { recipientPublicIdentifier, linkedHash, encryptedPreImage } = data;
    if (!recipientPublicIdentifier) {
      throw new RpcException(`Incorrect data received. Data: ${JSON.stringify(data)}`);
    }

    const transfer = await this.transferService.setRecipientAndEncryptedPreImageOnLinkedTransfer(
      pubId,
      recipientPublicIdentifier,
      encryptedPreImage,
      linkedHash,
    );
    return { linkedHash: transfer.linkedHash };
  }

  /**
   * Check in endpoint for client to call when it comes online to handle pending tasks
   * @param pubId
   */
  async clientCheckIn(pubId: string): Promise<void> {
    // reclaim collateral from redeemed transfers
    const reclaimableTransfers = await this.transferService.getLinkedTransfersForReclaim(pubId);
    for (const transfer of reclaimableTransfers) {
      await this.transferService.reclaimLinkedTransferCollateralByPaymentId(transfer.paymentId);
    }
  }

  async getPendingTransfers(pubId: string, data?: unknown): Promise<{ paymentId: string }[]> {
    const transfers = await this.transferService.getPendingTransfers(pubId);
    return transfers.map((transfer: LinkedTransfer) => {
      const { assetId, amount, encryptedPreImage, linkedHash, paymentId } = transfer;
      return { amount: amount.toString(), assetId, encryptedPreImage, linkedHash, paymentId };
    });
  }

  async getTransferHistory(pubId: string): Promise<Transfer[]> {
    return await this.transferService.getTransfersByPublicIdentifier(pubId);
  }

  async setupSubscriptions(): Promise<void> {
    await super.connectRequestReponse(
      "transfer.fetch-linked.>",
      this.authService.useUnverifiedPublicIdentifier(this.getLinkedTransferByPaymentId.bind(this)),
    );
    await super.connectRequestReponse(
      "transfer.resolve-linked.>",
      this.authService.useUnverifiedPublicIdentifier(this.resolveLinkedTransfer.bind(this)),
    );
    await super.connectRequestReponse(
      "transfer.set-recipient.>",
      this.authService.useUnverifiedPublicIdentifier(this.setRecipientOnLinkedTransfer.bind(this)),
    );
    await super.connectRequestReponse(
      "transfer.get-pending.>",
      this.authService.useUnverifiedPublicIdentifier(this.getPendingTransfers.bind(this)),
    );
    await super.connectRequestReponse(
      "transfer.get-history.>",
      this.authService.useUnverifiedPublicIdentifier(this.getTransferHistory.bind(this)),
    );
    await super.connectRequestReponse(
      "client.check-in.>",
      this.authService.useUnverifiedPublicIdentifier(this.clientCheckIn.bind(this)),
    );
  }
}

export const transferProviderFactory: FactoryProvider<Promise<void>> = {
  inject: [AuthService, LoggerService, MessagingProviderId, TransferService],
  provide: TransferProviderId,
  useFactory: async (
    authService: AuthService,
    logging: LoggerService,
    messaging: IMessagingService,
    transferService: TransferService,
  ): Promise<void> => {
    const transfer = new TransferMessaging(authService, logging, messaging, transferService);
    await transfer.setupSubscriptions();
  },
};
