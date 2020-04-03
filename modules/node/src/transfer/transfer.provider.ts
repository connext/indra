import { MessagingService } from "@connext/messaging";
import { TransferInfo } from "@connext/types";
import { FactoryProvider } from "@nestjs/common/interfaces";

import { AuthService } from "../auth/auth.service";
import { LoggerService } from "../logger/logger.service";
import { MessagingProviderId, TransferProviderId } from "../constants";
import { AbstractMessagingProvider } from "../util";
import { LinkedTransferService } from "../linkedTransfer/linkedTransfer.service";
import { DepositService } from "../deposit/deposit.service";

export class TransferMessaging extends AbstractMessagingProvider {
  constructor(
    private readonly authService: AuthService,
    log: LoggerService,
    messaging: MessagingService,
    private readonly linkedTransferService: LinkedTransferService,
    private readonly depositService: DepositService,
  ) {
    super(log, messaging);
    this.log.setContext("TransferMessaging");
  }

  async getTransferHistory(pubId: string): Promise<TransferInfo[]> {
    throw new Error("Unimplemented");
  }

  /**
   * Check in endpoint for client to call when it comes online to handle pending tasks
   * @param userPublicIdentifier
   */
  async clientCheckIn(userPublicIdentifier: string): Promise<void> {
    // reclaim collateral from redeemed transfers
    await this.linkedTransferService
      .unlockLinkedTransfersFromUser(userPublicIdentifier);

    // handle any installed deposit apps
    // TODO: refactor checkin message
    await this.depositService.handleDepositAppsOnCheckIn(userPublicIdentifier);
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
  inject: [AuthService, LoggerService, MessagingProviderId, LinkedTransferService, DepositService],
  provide: TransferProviderId,
  useFactory: async (
    authService: AuthService,
    logging: LoggerService,
    messaging: MessagingService,
    linkedTransferService: LinkedTransferService,
    depositService: DepositService,
  ): Promise<void> => {
    const transfer = new TransferMessaging(
      authService,
      logging,
      messaging,
      linkedTransferService,
      depositService,
    );
    await transfer.setupSubscriptions();
  },
};
