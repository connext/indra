import { MethodResults, NodeResponses } from "@connext/types";
import { MessagingService } from "@connext/messaging";
import { FactoryProvider } from "@nestjs/common/interfaces";
import { providers, utils } from "ethers";

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
    private readonly conditionalTransactionCommitmentRepository: ConditionalTransactionCommitmentRepository,
  ) {
    super(log, messaging);
  }

  async getChannel(pubId: string, data?: unknown): Promise<NodeResponses.GetChannel | undefined> {
    return this.channelService.getByUserPublicIdentifier(pubId);
  }

  async createChannel(pubId: string): Promise<MethodResults.CreateChannel> {
    return this.channelService.create(pubId);
  }

  async requestCollateral(
    userPublicIdentifier: string,
    data: { assetId?: string },
  ): Promise<providers.TransactionReceipt | undefined> {
    // do not allow clients to specify an amount to collateralize with
    const channel = await this.channelRepository.findByUserPublicIdentifierOrThrow(
      userPublicIdentifier,
    );
    try {
      const tx = await this.channelService.rebalance(
        channel,
        getAddress(data.assetId),
        RebalanceType.COLLATERALIZE,
      );
      return tx;
    } catch (e) {
      this.log.debug(`Failed to collateralize: ${e.message}`);
      return undefined;
    }
  }

  async addRebalanceProfile(pubId: string, data: { profile: RebalanceProfile }): Promise<void> {
    await this.channelService.addRebalanceProfileToChannel(pubId, data.profile);
  }

  async getRebalanceProfile(
    pubId: string,
    data: { assetId?: string },
  ): Promise<RebalanceProfile | undefined> {
    const prof = await this.channelRepository.getRebalanceProfileForChannelAndAsset(
      pubId,
      data.assetId,
    );
    return prof ? prof : undefined;
  }

  async getLatestWithdrawal(pubId: string, data: {}): Promise<OnchainTransaction | undefined> {
    return this.onchainTransactionRepository.findLatestWithdrawalByUserPublicIdentifier(pubId);
  }

  async getChannelInformationForRestore(pubId: string): Promise<NodeResponses.ChannelRestore> {
    const channel = await this.channelService.getStateChannel(pubId);
    if (!channel) {
      throw new Error(`No channel found for user: ${pubId}`);
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
    const network = await this.configService.getContractAddresses();
    return {
      channel,
      setupCommitment: convertSetupEntityToMinimalTransaction(setupCommitment),
      setStateCommitments: setStateCommitments.map((s) => [s.app.identityHash, setStateToJson(s)]),
      conditionalCommitments: conditionalCommitments.map((c) => [
        c.app.identityHash,
        convertConditionalCommitmentToJson(c, network),
      ]),
    };
  }

  async setupSubscriptions(): Promise<void> {
    await super.connectRequestReponse(
      "*.channel.get",
      this.authService.parseIdentifier(this.getChannel.bind(this)),
    );
    await super.connectRequestReponse(
      "*.channel.create",
      this.authService.parseIdentifier(this.createChannel.bind(this)),
    );
    await super.connectRequestReponse(
      "*.channel.request-collateral",
      this.authService.parseIdentifier(this.requestCollateral.bind(this)),
    );
    await super.connectRequestReponse(
      "*.channel.get-profile",
      this.authService.parseIdentifier(this.getRebalanceProfile.bind(this)),
    );
    await super.connectRequestReponse(
      "*.channel.restore",
      this.authService.parseIdentifier(this.getChannelInformationForRestore.bind(this)),
    );
    await super.connectRequestReponse(
      "*.channel.latestWithdrawal",
      this.authService.parseIdentifier(this.getLatestWithdrawal.bind(this)),
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
