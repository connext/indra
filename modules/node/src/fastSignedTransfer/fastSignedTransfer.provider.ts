import { IMessagingService } from "@connext/messaging";
import {
  Transfer,
  replaceBN,
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

export class FastSignedTransferMessaging extends AbstractMessagingProvider {
  constructor(
    private readonly authService: AuthService,
    log: LoggerService,
    messaging: IMessagingService,
    private readonly fastSignedTransferService: FastSignedTransferService,
    private readonly transferRepository: TransferRepository,
  ) {
    super(log, messaging);
    log.setContext("FastSignedTransferMessaging");
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

  async setupSubscriptions(): Promise<void> {
    await super.connectRequestReponse(
      "transfer.resolve-fast-signed.>",
      this.authService.useUnverifiedPublicIdentifier(this.resolveFastSignedTransfer.bind(this)),
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
  ],
  provide: FastSignedTransferProviderId,
  useFactory: async (
    authService: AuthService,
    logging: LoggerService,
    messaging: IMessagingService,
    fastSignedTransferService: FastSignedTransferService,
    transferRepository: TransferRepository,
  ): Promise<void> => {
    const transfer = new FastSignedTransferMessaging(
      authService,
      logging,
      messaging,
      fastSignedTransferService,
      transferRepository,
    );
    await transfer.setupSubscriptions();
  },
};
