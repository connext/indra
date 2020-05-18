import { MessagingService } from "@connext/messaging";
import { FactoryProvider } from "@nestjs/common/interfaces";

import { AuthService } from "../auth/auth.service";
import { LoggerService } from "../logger/logger.service";
import { LockProviderId, MessagingProviderId } from "../constants";
import { AbstractMessagingProvider } from "../messaging/abstract.provider";

import { LockService } from "./lock.service";

class LockMessaging extends AbstractMessagingProvider {
  constructor(
    private readonly authService: AuthService,
    private readonly lockService: LockService,
    log: LoggerService,
    messaging: MessagingService,
  ) {
    super(log, messaging);
  }

  async acquireLock(lockName: string): Promise<string> {
    return this.lockService.acquireLock(lockName);
  }

  async releaseLock(lockName: string, data: { lockValue: string }): Promise<void> {
    return this.lockService.releaseLock(lockName, data.lockValue);
  }

  async setupSubscriptions(): Promise<void> {
    await super.connectRequestReponse(
      "*.lock.acquire.>",
      this.authService.parseLock(this.acquireLock.bind(this)),
    );
    await super.connectRequestReponse(
      "*.lock.release.>",
      this.authService.parseLock(this.releaseLock.bind(this)),
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
    messaging: MessagingService,
  ): Promise<void> => {
    const lock = new LockMessaging(authService, lockService, log, messaging);
    await lock.setupSubscriptions();
  },
};
