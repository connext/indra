import { IMessagingService } from "@connext/messaging";
import { FactoryProvider } from "@nestjs/common/interfaces";

import { AuthService } from "../auth/auth.service";
import { LoggerService } from "../logger/logger.service";
import { LockProviderId, MessagingProviderId } from "../constants";
import { AbstractMessagingProvider } from "../util";

import { LockService } from "./lock.service";

class LockMessaging extends AbstractMessagingProvider {
  constructor(
    private readonly authService: AuthService,
    private readonly lockService: LockService,
    log: LoggerService,
    messaging: IMessagingService,
  ) {
    super(log, messaging);
  }

  async acquireLock(multisig: string, data: { lockTTL: number }): Promise<string> {
    return await this.lockService.acquireLock(multisig, data.lockTTL);
  }

  async releaseLock(multisig: string, data: { lockValue: string }): Promise<void> {
    return await this.lockService.releaseLock(multisig, data.lockValue);
  }

  async setupSubscriptions(): Promise<void> {
    super.connectRequestReponse(
      "lock.acquire.>",
      this.authService.useUnverifiedHexString(this.acquireLock.bind(this)),
    );
    super.connectRequestReponse(
      "lock.release.>",
      this.authService.useUnverifiedHexString(this.releaseLock.bind(this)),
    );
  }
}

export const lockProviderFactory: FactoryProvider<Promise<void>> = {
  inject: [AuthService, LockService, LoggerService, MessagingProviderId],
  provide: LockProviderId,
  useFactory: async (
    authService: AuthService,
    lockService: LockService,
    log: LoggerService,
    messaging: IMessagingService,
  ): Promise<void> => {
    const lock = new LockMessaging(authService, lockService, log, messaging);
    await lock.setupSubscriptions();
  },
};
