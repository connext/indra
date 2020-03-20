import { IMessagingService } from "@connext/messaging";
import {
  ResolveHashLockTransferResponse,
  HashLockTransferAppState,
  GetHashLockTransferResponse,
} from "@connext/types";
import { FactoryProvider } from "@nestjs/common/interfaces";
import { RpcException } from "@nestjs/microservices";

import { AuthService } from "../auth/auth.service";
import { LoggerService } from "../logger/logger.service";
import { MessagingProviderId, LinkedTransferProviderId } from "../constants";
import { AbstractMessagingProvider } from "../util";
import { CFCoreService } from "../cfCore/cfCore.service";
import { ChannelRepository } from "../channel/channel.repository";

import { HashLockTransferService } from "./hashLockTransfer.service";

export class HashLockTransferMessaging extends AbstractMessagingProvider {
  constructor(
    private readonly authService: AuthService,
    log: LoggerService,
    messaging: IMessagingService,
    private readonly hashLockTransferService: HashLockTransferService,
    private readonly cfCoreService: CFCoreService,
    private readonly channelRepository: ChannelRepository,
  ) {
    super(log, messaging);
    log.setContext("LinkedTransferMessaging");
  }

  async resolveHashLockTransfer(
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
      amount: response.amount,
    };
  }

  async getHashLockTransfer(
    pubId: string,
    { lockHash }: { lockHash: string },
  ): Promise<GetHashLockTransferResponse> {
    // TODO: there shouldn't really ever be more than one, we should probably enforce this
    const [senderApp] = await this.cfCoreService.getHashLockTransferAppsByLockHash(lockHash);
    const appState = senderApp.latestState as HashLockTransferAppState;
    const channel = await this.channelRepository.findByMultisigAddressOrThrow(
      senderApp.multisigAddress,
    );
    return {
      amount: appState.coinTransfers[0].amount.toString(),
      assetId: senderApp.singleAssetTwoPartyCoinTransferInterpreterParams.tokenAddress,
      lockHash,
      sender: channel.userPublicIdentifier,
      meta: {}, // TODO
    };
  }

  async setupSubscriptions(): Promise<void> {
    await super.connectRequestReponse(
      "transfer.resolve-hashlock.>",
      this.authService.useUnverifiedPublicIdentifier(this.resolveHashLockTransfer.bind(this)),
    );

    await super.connectRequestReponse(
      "transfer.get-hashlock.>",
      this.authService.useUnverifiedPublicIdentifier(this.getHashLockTransfer.bind(this)),
    );
  }
}

export const hashLockTransferProviderFactory: FactoryProvider<Promise<void>> = {
  inject: [
    AuthService,
    LoggerService,
    MessagingProviderId,
    HashLockTransferService,
    CFCoreService,
    ChannelRepository,
  ],
  provide: LinkedTransferProviderId,
  useFactory: async (
    authService: AuthService,
    logging: LoggerService,
    messaging: IMessagingService,
    hashLockTransferService: HashLockTransferService,
    cfCoreService: CFCoreService,
    channelRepository: ChannelRepository,
  ): Promise<void> => {
    const transfer = new HashLockTransferMessaging(
      authService,
      logging,
      messaging,
      hashLockTransferService,
      cfCoreService,
      channelRepository,
    );
    await transfer.setupSubscriptions();
  },
};
