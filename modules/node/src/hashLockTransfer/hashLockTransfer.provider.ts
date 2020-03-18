import { IMessagingService } from "@connext/messaging";
import { replaceBN, ResolveHashLockTransferResponse } from "@connext/types";
import { FactoryProvider } from "@nestjs/common/interfaces";
import { RpcException } from "@nestjs/microservices";

import { AuthService } from "../auth/auth.service";
import { LoggerService } from "../logger/logger.service";
import { MessagingProviderId, LinkedTransferProviderId } from "../constants";
import { AbstractMessagingProvider } from "../util";

import { HashLockTransferService } from "./hashLockTransfer.service";

export class HashLockTransferMessaging extends AbstractMessagingProvider {
  constructor(
    private readonly authService: AuthService,
    log: LoggerService,
    messaging: IMessagingService,
    private readonly hashLockTransferService: HashLockTransferService,
  ) {
    super(log, messaging);
    log.setContext("LinkedTransferMessaging");
  }

  async resolveLinkedTransfer(
    pubId: string,
    { lockHash }: { lockHash: string },
  ): Promise<ResolveHashLockTransferResponse> {
    this.log.debug(`Got resolve link request with lockHash: ${lockHash}`);
    if (!lockHash) {
      throw new RpcException(`Incorrect data received. Data: ${JSON.stringify(lockHash)}`);
    }
    const response = await this.hashLockTransferService.resolveHashLockTransfer(pubId, lockHash);
    return {
      ...response,
      amount: response.amount.toString(),
    };
  }

  async setupSubscriptions(): Promise<void> {
    await super.connectRequestReponse(
      "transfer.resolve-hashlock.>",
      this.authService.useUnverifiedPublicIdentifier(this.resolveLinkedTransfer.bind(this)),
    );
  }
}

export const hashLockTransferProviderFactory: FactoryProvider<Promise<void>> = {
  inject: [AuthService, LoggerService, MessagingProviderId, HashLockTransferService],
  provide: LinkedTransferProviderId,
  useFactory: async (
    authService: AuthService,
    logging: LoggerService,
    messaging: IMessagingService,
    hashLockTransferService: HashLockTransferService,
  ): Promise<void> => {
    const transfer = new HashLockTransferMessaging(
      authService,
      logging,
      messaging,
      hashLockTransferService,
    );
    await transfer.setupSubscriptions();
  },
};
