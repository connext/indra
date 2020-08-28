import { MethodResults, NodeResponses } from "@connext/types";
import { MessagingService } from "@connext/messaging";
import { FactoryProvider } from "@nestjs/common/interfaces";
import { utils, constants, BigNumber } from "ethers";

import { AuthService } from "../auth/auth.service";
import { LoggerService } from "../logger/logger.service";
import { ConfigService } from "../config/config.service";
import { ChannelMessagingProviderId, MessagingProviderId } from "../constants";
import { AbstractMessagingProvider } from "../messaging/abstract.provider";
import { OnchainTransaction } from "../onchainTransactions/onchainTransaction.entity";
import { OnchainTransactionRepository } from "../onchainTransactions/onchainTransaction.repository";

import { RebalanceProfile } from "../rebalanceProfile/rebalanceProfile.entity";

import {
  setStateToJson,
  SetStateCommitmentRepository,
} from "../setStateCommitment/setStateCommitment.repository";
import {
  convertConditionalCommitmentToJson,
  ConditionalTransactionCommitmentRepository,
} from "../conditionalCommitment/conditionalCommitment.repository";
import {
  convertSetupEntityToMinimalTransaction,
  SetupCommitmentRepository,
} from "../setupCommitment/setupCommitment.repository";

import { ChannelRepository } from "./channel.repository";
import { ChannelService, RebalanceType } from "./channel.service";

const { getAddress } = utils;

class ChannelMessaging extends AbstractMessagingProvider {
  constructor(
    private readonly authService: AuthService,
    log: LoggerService,
    messaging: MessagingService,
    private readonly channelService: ChannelService,
    private readonly configService: ConfigService,
    private readonly channelRepository: ChannelRepository,
    private readonly onchainTransactionRepository: OnchainTransactionRepository,
    private readonly setupCommitmentRepository: SetupCommitmentRepository,
    private readonly setStateCommitmentRepository: SetStateCommitmentRepository,
    // eslint-disable-next-line max-len
    private readonly conditionalTransactionCommitmentRepository: ConditionalTransactionCommitmentRepository,
  ) {
    super(log, messaging);
  }

  async getChannel(
    pubId: string,
    chainId: number,
    data?: unknown,
  ): Promise<NodeResponses.GetChannel | undefined> {
    return this.channelService.getByUserPublicIdentifier(pubId, chainId);
  }

  async createChannel(pubId: string, chainId: number): Promise<MethodResults.CreateChannel> {
    return this.channelService.create(pubId, chainId);
  }

  async requestCollateral(
    userPublicIdentifier: string,
    chainId: number,
    data: { assetId?: string; amount?: string },
  ): Promise<NodeResponses.RequestCollateral> {
    // do not allow clients to specify an amount to collateralize with
    const channel = await this.channelRepository.findByUserPublicIdentifierAndChainOrThrow(
      userPublicIdentifier,
      chainId,
    );
    try {
      const requestedTarget = data.amount ? BigNumber.from(data.amount) : undefined;
      const response = await this.channelService.rebalance(
        channel.multisigAddress,
        getAddress(data.assetId || constants.AddressZero),
        RebalanceType.COLLATERALIZE,
        requestedTarget,
      );
      return (
        response && {
          transaction: response.transaction!,
          depositAppIdentityHash: response.appIdentityHash!,
        }
      );
    } catch (e) {
      this.log.warn(`Failed to collateralize: ${e.message}`);
      return undefined;
    }
  }

  async addRebalanceProfile(
    pubId: string,
    chainId: number,
    data: { profile: RebalanceProfile },
  ): Promise<void> {
    await this.channelService.addRebalanceProfileToChannel(pubId, chainId, data.profile);
  }

  async getRebalanceProfile(
    pubId: string,
    chainId: number,
    data: { assetId?: string },
  ): Promise<RebalanceProfile | undefined> {
    const prof = await this.channelRepository.getRebalanceProfileForChannelAndAsset(
      pubId,
      chainId,
      data.assetId,
    );
    return prof ? prof : undefined;
  }

  async getLatestWithdrawal(
    pubId: string,
    chainId: number,
    data: {},
  ): Promise<OnchainTransaction | undefined> {
    return this.onchainTransactionRepository.findLatestWithdrawalByUserPublicIdentifierAndChain(
      pubId,
      chainId,
    );
  }

  async getChannelInformationForRestore(
    pubId: string,
    chainId: number,
  ): Promise<NodeResponses.ChannelRestore> {
    const channel = await this.channelService.getStateChannel(pubId, chainId);
    if (!channel) {
      throw new Error(`No state channel found for user: ${pubId}`);
    }
    // get setup commitment
    const setupCommitment = await this.setupCommitmentRepository.findByMultisigAddress(
      channel.multisigAddress,
    );
    if (!setupCommitment) {
      throw new Error(`Found channel, but no setup commitment. This should not happen.`);
    }
    // get active app set state commitments
    const setStateCommitments = await this.setStateCommitmentRepository.findAllActiveCommitmentsByMultisig(
      channel.multisigAddress,
    );

    // get active app conditional transaction commitments
    const conditionalCommitments = await this.conditionalTransactionCommitmentRepository.findAllActiveCommitmentsByMultisig(
      channel.multisigAddress,
    );
    return {
      channel,
      setupCommitment: convertSetupEntityToMinimalTransaction(setupCommitment),
      setStateCommitments: setStateCommitments.map((s) => [s.app.identityHash, setStateToJson(s)]),
      conditionalCommitments: conditionalCommitments.map((c) => [
        c.app.identityHash,
        convertConditionalCommitmentToJson(c),
      ]),
    };
  }

  async setupSubscriptions(): Promise<void> {
    await super.connectRequestReponse(
      `*.${this.configService.getPublicIdentifier()}.*.channel.get`,
      this.authService.parseIdentifierAndChain(this.getChannel.bind(this)),
    );
    await super.connectRequestReponse(
      `*.${this.configService.getPublicIdentifier()}.*.channel.create`,
      this.authService.parseIdentifierAndChain(this.createChannel.bind(this)),
    );
    await super.connectRequestReponse(
      `*.${this.configService.getPublicIdentifier()}.*.channel.request-collateral`,
      this.authService.parseIdentifierAndChain(this.requestCollateral.bind(this)),
    );
    await super.connectRequestReponse(
      `*.${this.configService.getPublicIdentifier()}.*.channel.get-profile`,
      this.authService.parseIdentifierAndChain(this.getRebalanceProfile.bind(this)),
    );
    await super.connectRequestReponse(
      `*.${this.configService.getPublicIdentifier()}.*.channel.restore`,
      this.authService.parseIdentifierAndChain(this.getChannelInformationForRestore.bind(this)),
    );
    await super.connectRequestReponse(
      `*.${this.configService.getPublicIdentifier()}.*.channel.latestWithdrawal`,
      this.authService.parseIdentifierAndChain(this.getLatestWithdrawal.bind(this)),
    );
  }
}

export const channelProviderFactory: FactoryProvider<Promise<void>> = {
  inject: [
    AuthService,
    LoggerService,
    MessagingProviderId,
    ChannelService,
    ConfigService,
    ChannelRepository,
    OnchainTransactionRepository,
    SetupCommitmentRepository,
    SetStateCommitmentRepository,
    ConditionalTransactionCommitmentRepository,
  ],
  provide: ChannelMessagingProviderId,
  useFactory: async (
    authService: AuthService,
    log: LoggerService,
    messaging: MessagingService,
    channelService: ChannelService,
    config: ConfigService,
    channelRepo: ChannelRepository,
    onchain: OnchainTransactionRepository,
    setup: SetupCommitmentRepository,
    setState: SetStateCommitmentRepository,
    conditional: ConditionalTransactionCommitmentRepository,
  ): Promise<void> => {
    const channel = new ChannelMessaging(
      authService,
      log,
      messaging,
      channelService,
      config,
      channelRepo,
      onchain,
      setup,
      setState,
      conditional,
    );
    await channel.setupSubscriptions();
  },
};
