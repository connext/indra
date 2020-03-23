<<<<<<< HEAD
import { IMessagingService } from "@connext/messaging";
import { TransferInfo, stringify } from "@connext/types";
=======
import { MessagingService } from "@connext/messaging";
import { Transfer } from "@connext/types";
>>>>>>> nats-messaging-refactor
import { FactoryProvider } from "@nestjs/common/interfaces";

import { AuthService } from "../auth/auth.service";
import { LoggerService } from "../logger/logger.service";
import { MessagingProviderId, TransferProviderId } from "../constants";
import { AbstractMessagingProvider } from "../util";
import { LinkedTransferService } from "../linkedTransfer/linkedTransfer.service";

export class TransferMessaging extends AbstractMessagingProvider {
  constructor(
    private readonly authService: AuthService,
    log: LoggerService,
    messaging: MessagingService,
    private readonly linkedTransferService: LinkedTransferService,
  ) {
    super(log, messaging);
    this.log.setContext("TransferMessaging");
  }

<<<<<<< HEAD
  async getTransferHistory(pubId: string): Promise<TransferInfo[]> {
    return await this.transferRepository.findByPublicIdentifier(pubId);
=======
  async getTransferHistory(pubId: string): Promise<Transfer[]> {
    throw new Error("Unimplemented");
>>>>>>> nats-messaging-refactor
  }

  /**
   * Check in endpoint for client to call when it comes online to handle pending tasks
   * @param userPublicIdentifier
   */
  async clientCheckIn(userPublicIdentifier: string): Promise<void> {
    // reclaim collateral from redeemed transfers
    // eslint-disable-next-line max-len
    await this.linkedTransferService.unlockLinkedTransfersFromUser(userPublicIdentifier);
  }

  async setupSubscriptions(): Promise<void> {
    await super.connectRequestReponse(
      "*.transfer.get-history",
      this.authService.parseXpub(this.getTransferHistory.bind(this)),
    );

    await super.connectRequestReponse(
      "*.client.check-in",
      this.authService.parseXpub(this.clientCheckIn.bind(this)),
    );
  }
}

export const transferProviderFactory: FactoryProvider<Promise<void>> = {
  inject: [AuthService, LoggerService, MessagingProviderId, LinkedTransferService],
  provide: TransferProviderId,
  useFactory: async (
    authService: AuthService,
    logging: LoggerService,
    messaging: MessagingService,
    linkedTransferService: LinkedTransferService,
  ): Promise<void> => {
    const transfer = new TransferMessaging(authService, logging, messaging, linkedTransferService);
    await transfer.setupSubscriptions();
  },
};
