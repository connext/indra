import { IMessagingService } from "@connext/messaging";
import { Transfer } from "@connext/types";
import { FactoryProvider } from "@nestjs/common/interfaces";

import { AuthService } from "../auth/auth.service";
import { LoggerService } from "../logger/logger.service";
import { MessagingProviderId, TransferProviderId } from "../constants";
import { AbstractMessagingProvider } from "../util";
import { TransferRepository } from "./transfer.repository";

export class TransferMessaging extends AbstractMessagingProvider {
  constructor(
    private readonly authService: AuthService,
    log: LoggerService,
    messaging: MessagingService,
    private readonly transferRepository: TransferRepository,
  ) {
    super(log, messaging);
    this.log.setContext("TransferMessaging");
  }

  async getTransferHistory(pubId: string): Promise<Transfer[]> {
    return await this.transferRepository.findByPublicIdentifier(pubId);
  }

  async setupSubscriptions(): Promise<void> {
    await super.connectRequestReponse(
      "transfer.get-history.>",
      this.authService.parseXpub(this.getTransferHistory.bind(this)),
    );
  }
}

export const transferProviderFactory: FactoryProvider<Promise<void>> = {
  inject: [AuthService, LoggerService, MessagingProviderId, TransferRepository],
  provide: TransferProviderId,
  useFactory: async (
    authService: AuthService,
    logging: LoggerService,
    messaging: IMessagingService,
    transferRepository: TransferRepository,
  ): Promise<void> => {
    const transfer = new TransferMessaging(authService, logging, messaging, transferRepository);
    await transfer.setupSubscriptions();
  },
};
