import { IMessagingService } from "@connext/messaging";
import { FactoryProvider } from "@nestjs/common/interfaces";
import { Lock } from "redlock";

import { LockProviderId, MessagingProviderId } from "../constants";
import { AbstractMessagingProvider } from "../util";

import { LockService } from "./lock.service";

class LockMessaging extends AbstractMessagingProvider {
  constructor(messaging: IMessagingService, private readonly lockService: LockService) {
    super(messaging);
  }

  async acquireLock(subject: string): Promise<Lock> {
    const lockName = subject.split(".").pop(); // last item of subject is lock name
    return await this.lockService.acquireLock(lockName);
  }

  async releaseLock(subject: string): Promise<void> {
    const lockName = subject.split(".").pop(); // last item of subject is lock name
    return await this.lockService.releaseLock(lockName);
  }

  async setupSubscriptions(): Promise<void> {
    super.connectRequestReponse("lock.acquire.>", this.acquireLock.bind(this));
    super.connectRequestReponse("lock.release.>", this.releaseLock.bind(this));
  }
}

export const lockProviderFactory: FactoryProvider<Promise<void>> = {
  inject: [MessagingProviderId, LockService],
  provide: LockProviderId,
  useFactory: async (messaging: IMessagingService, lockService: LockService): Promise<void> => {
    const lock = new LockMessaging(messaging, lockService);
    await lock.setupSubscriptions();
  },
};
