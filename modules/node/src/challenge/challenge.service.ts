import { Injectable, OnModuleInit } from "@nestjs/common";
import { LoggerService } from "../logger/logger.service";
import { AppInstanceRepository } from "../appInstance/appInstance.repository";
import { ChannelRepository } from "../channel/channel.repository";
import { ConfigService } from "../config/config.service";
import { IWatcher } from "@connext/types";

@Injectable()
export class ChallengeService implements OnModuleInit {
  private readonly watcher: IWatcher | undefined = undefined;
  constructor(
    private readonly channelRepository: ChannelRepository,
    private readonly appInstanceRepository: AppInstanceRepository,
    private readonly configService: ConfigService,
    private readonly log: LoggerService,
  ) {
    this.log.setContext("ChallengeService");
  }

  async initiateChallenge(appIdentityHash: string, mutlsigAddress: string) {
    throw new Error("Method not yet implemented");
  }

  async cancelChallenge(userSignature: string, appIdentityHash: string, multisigAddress: string) {
    // Verify the signature is on the proper nonce
    // Call cancel challenge
    throw new Error("Method not yet implemented");
  }

  async onModuleInit(): Promise<void> {
    throw new Error("Method not yet implemented");
  }
}
