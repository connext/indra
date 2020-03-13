import { IMessagingService } from "@connext/messaging";
import {
  Transfer,
  replaceBN,
  PendingAsyncTransfer,
  ResolveFastSignedTransferResponse,
  PendingFastSignedTransfer,
} from "@connext/types";
import { FactoryProvider } from "@nestjs/common/interfaces";
import { RpcException } from "@nestjs/microservices";

import { AuthService } from "../auth/auth.service";
import { LoggerService } from "../logger/logger.service";
import { MessagingProviderId, FastSignedTransferProviderId } from "../constants";
import { AbstractMessagingProvider } from "../util";
import { TransferRepository } from "../transfer/transfer.repository";

import { FastSignedTransferService } from "./fastSignedTransfer.service";
import { FastSignedTransferRepository } from "./fastSignedTransfer.repository";
import { FastSignedTransfer } from "./fastSignedTransfer.entity";

export class FastSignedTransferMessaging extends AbstractMessagingProvider {
  constructor(
    private readonly authService: AuthService,
    log: LoggerService,
    messaging: IMessagingService,
    private readonly fastSignedTransferService: FastSignedTransferService,
    private readonly transferRepository: TransferRepository,
    private readonly fastSignedTransferRepository: FastSignedTransferRepository,
  ) {
    super(log, messaging);
    log.setContext("FastSignedTransferMessaging");
  }

  async getFastSignedTransferByPaymentId(
    pubId: string,
    data: { paymentId: string },
  ): Promise<Transfer> {
    if (!data.paymentId) {
      throw new RpcException(`Incorrect data received. Data: ${JSON.stringify(data)}`);
    }
    this.log.info(`Got fetch fast signed transfer for: ${data.paymentId}`);
    return await this.transferRepository.findByPaymentId(data.paymentId);
  }

  async resolveFastSignedTransfer(
    pubId: string,
    { paymentId }: { paymentId: string },
  ): Promise<ResolveFastSignedTransferResponse> {
    this.log.debug(
      `Got resolve fast signed request with data: ${JSON.stringify(paymentId, replaceBN, 2)}`,
    );
    if (!paymentId) {
      throw new RpcException(`Incorrect data received. Data: ${JSON.stringify(paymentId)}`);
    }
    const response = await this.fastSignedTransferService.resolveFastSignedTransfer(
      pubId,
      paymentId,
    );
    return {
      ...response,
      amount: response.amount.toString(),
    };
  }

  async getPendingTransfers(pubId: string): Promise<PendingFastSignedTransfer[]> {
    const transfers = await this.fastSignedTransferRepository.findPendingByRecipient(pubId);
    return transfers.map((transfer: FastSignedTransfer) => {
      const { assetId, amount, paymentId, signer } = transfer;
      return { amount: amount.toString(), assetId, paymentId, signer };
    });
  }

  async setupSubscriptions(): Promise<void> {
    await super.connectRequestReponse(
      "transfer.fetch-fast-signed.>",
      this.authService.useUnverifiedPublicIdentifier(
        this.getFastSignedTransferByPaymentId.bind(this),
      ),
    );
    await super.connectRequestReponse(
      "transfer.resolve-fast-signed.>",
      this.authService.useUnverifiedPublicIdentifier(this.resolveFastSignedTransfer.bind(this)),
    );
    await super.connectRequestReponse(
      "transfer.get-pending-fast-signed.>",
      this.authService.useUnverifiedPublicIdentifier(this.getPendingTransfers.bind(this)),
    );
  }
}

export const fastSignedTransferProviderFactory: FactoryProvider<Promise<void>> = {
  inject: [
    AuthService,
    LoggerService,
    MessagingProviderId,
    FastSignedTransferService,
    TransferRepository,
    FastSignedTransferRepository,
  ],
  provide: FastSignedTransferProviderId,
  useFactory: async (
    authService: AuthService,
    logging: LoggerService,
    messaging: IMessagingService,
    fastSignedTransferService: FastSignedTransferService,
    transferRepository: TransferRepository,
    fastSignedTransferRepository: FastSignedTransferRepository,
  ): Promise<void> => {
    const transfer = new FastSignedTransferMessaging(
      authService,
      logging,
      messaging,
      fastSignedTransferService,
      transferRepository,
      fastSignedTransferRepository,
    );
    await transfer.setupSubscriptions();
  },
};
