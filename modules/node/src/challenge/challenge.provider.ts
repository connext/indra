import { AbstractMessagingProvider } from "../messaging/abstract.provider";
import { ChallengeService } from "./challenge.service";
import { ChannelRepository } from "../channel/channel.repository";
import { AuthService } from "../auth/auth.service";
import { LoggerService } from "../logger/logger.service";
import { MessagingService } from "@connext/messaging";
import { ConfigService } from "../config/config.service";
import { FactoryProvider } from "@nestjs/common";
import { ChallengeMessagingProviderId } from "../constants";
import { TransactionResponse } from "@connext/types";

class ChallengeMessaging extends AbstractMessagingProvider {
  constructor(
    private readonly authService: AuthService,
    log: LoggerService,
    messaging: MessagingService,
    private readonly challengeService: ChallengeService,
    private readonly configService: ConfigService,
    private readonly channelRepository: ChannelRepository,
  ) {
    super(log, messaging);
  }

  async cancelChallenge(
    pubId: string,
    chainId: number,
    data: { signature: string; appIdentityHash: string },
  ): Promise<TransactionResponse> {
    const channel = await this.channelRepository.findByUserPublicIdentifierAndChainOrThrow(
      pubId,
      chainId,
    );
    return this.challengeService.cancelChallenge(
      data.signature,
      data.appIdentityHash,
      channel.multisigAddress,
    );
  }

  async initiateChallenge(
    pubId: string,
    chainId: number,
    data: { multisigAddress: string; appIdentityHash: string },
  ) {
    return this.challengeService.initiateChallenge(data.appIdentityHash, data.multisigAddress);
  }

  async setupSubscriptions(): Promise<void> {
    await super.connectRequestReponse(
      `*.${this.configService.getPublicIdentifier()}.*.challenge.cancel`,
      this.authService.parseIdentifierAndChain(this.cancelChallenge.bind(this)),
    );

    // FIXME: is this admin only
    await super.connectRequestReponse(
      `${this.configService.getPublicIdentifier()}.*.challenge.initiate`,
      this.authService.parseIdentifierAndChain(this.initiateChallenge.bind(this)),
    );
  }
}

export const challengeProviderFactory: FactoryProvider<Promise<void>> = {
  inject: [],
  provide: ChallengeMessagingProviderId,
  useFactory: async (
    authService: AuthService,
    log: LoggerService,
    messaging: MessagingService,
    challengeService: ChallengeService,
    config: ConfigService,
    channelRepo: ChannelRepository,
  ): Promise<void> => {
    const challenge = new ChallengeMessaging(
      authService,
      log,
      messaging,
      challengeService,
      config,
      channelRepo,
    );
    await challenge.setupSubscriptions();
  },
};
