import { MessagingService } from "@connext/messaging";
import {
  ResolveLinkedTransferResponse,
  Transfer,
  replaceBN,
  stringify,
  PendingAsyncTransfer,
} from "@connext/types";
import { FactoryProvider } from "@nestjs/common/interfaces";
import { RpcException } from "@nestjs/microservices";

import { AuthService } from "../auth/auth.service";
import { LoggerService } from "../logger/logger.service";
import { MessagingProviderId, LinkedTransferProviderId } from "../constants";
import { AbstractMessagingProvider } from "../util";
import { TransferRepository } from "../transfer/transfer.repository";

import { LinkedTransfer } from "./linkedTransfer.entity";
import { LinkedTransferService } from "./linkedTransfer.service";
import { LinkedTransferRepository } from "./linkedTransfer.repository";

export class LinkedTransferMessaging extends AbstractMessagingProvider {
  constructor(
    private readonly authService: AuthService,
    log: LoggerService,
    messaging: MessagingService,
    private readonly linkedTransferService: LinkedTransferService,
    private readonly transferRepository: TransferRepository,
    private readonly linkedTransferRepository: LinkedTransferRepository,
  ) {
    super(log, messaging);
    log.setContext("LinkedTransferMessaging");
  }

  async getLinkedTransferByPaymentId(
    pubId: string,
    data: { paymentId: string },
  ): Promise<Transfer> {
    if (!data.paymentId) {
      throw new RpcException(`Incorrect data received. Data: ${JSON.stringify(data)}`);
    }
    this.log.info(`Got fetch link request for: ${data.paymentId}`);
    return await this.transferRepository.findByPaymentId(data.paymentId);
  }

  async resolveLinkedTransfer(
    pubId: string,
    { paymentId }: { paymentId: string },
  ): Promise<ResolveLinkedTransferResponse> {
    this.log.debug(
      `Got resolve link request with data: ${JSON.stringify(paymentId, replaceBN, 2)}`,
    );
    if (!paymentId) {
      throw new RpcException(`Incorrect data received. Data: ${JSON.stringify(paymentId)}`);
    }
    const response = await this.linkedTransferService.resolveLinkedTransfer(pubId, paymentId);
    return {
      ...response,
      amount: response.amount.toString(),
    };
  }

  async getPendingTransfers(pubId: string): Promise<PendingAsyncTransfer[]> {
    const transfers = await this.linkedTransferRepository.findPendingByRecipient(pubId);
    return transfers.map((transfer: LinkedTransfer) => {
      const { assetId, amount, encryptedPreImage, linkedHash, paymentId } = transfer;
      return { amount: amount.toString(), assetId, encryptedPreImage, linkedHash, paymentId };
    });
  }

  /**
   * Check in endpoint for client to call when it comes online to handle pending tasks
   * @param pubId
   */
  async clientCheckIn(pubId: string): Promise<void> {
    // reclaim collateral from redeemed transfers
    const reclaimableTransfers = await this.linkedTransferService.getLinkedTransfersForReclaim(
      pubId,
    );
    for (const transfer of reclaimableTransfers) {
      try {
        await this.linkedTransferService.reclaimLinkedTransferCollateralByPaymentId(
          transfer.paymentId,
        );
      } catch (e) {
        this.log.error(`Error reclaiming transfer: ${stringify(e.stack || e.message)}`);
      }
    }
  }

  async setupSubscriptions(): Promise<void> {
    await super.connectRequestReponse(
      "*.transfer.fetch-linked",
      this.authService.parseXpub(this.getLinkedTransferByPaymentId.bind(this)),
    );
    await super.connectRequestReponse(
      "*.transfer.resolve-linked",
      this.authService.parseXpub(this.resolveLinkedTransfer.bind(this)),
    );
    await super.connectRequestReponse(
      "*.transfer.get-pending",
      this.authService.parseXpub(this.getPendingTransfers.bind(this)),
    );
    await super.connectRequestReponse(
      "*.client.check-in",
      this.authService.parseXpub(this.clientCheckIn.bind(this)),
    );
  }
}

export const linkedTransferProviderFactory: FactoryProvider<Promise<void>> = {
  inject: [
    AuthService,
    LoggerService,
    MessagingProviderId,
    LinkedTransferService,
    TransferRepository,
    LinkedTransferRepository,
  ],
  provide: LinkedTransferProviderId,
  useFactory: async (
    authService: AuthService,
    logging: LoggerService,
    messaging: MessagingService,
    linkedTransferService: LinkedTransferService,
    transferRepository: TransferRepository,
    linkedTransferRepository: LinkedTransferRepository,
  ): Promise<void> => {
    const transfer = new LinkedTransferMessaging(
      authService,
      logging,
      messaging,
      linkedTransferService,
      transferRepository,
      linkedTransferRepository,
    );
    await transfer.setupSubscriptions();
  },
};
