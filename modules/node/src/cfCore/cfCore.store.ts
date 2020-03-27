import { Injectable } from "@nestjs/common";
import {
  AppInstanceJson,
  AppInstanceProposal,
  ConditionalTransactionCommitmentJSON,
  IStoreService,
  MinimalTransaction,
  SetStateCommitmentJSON,
  StateChannelJSON,
  STORE_SCHEMA_VERSION,
  OutcomeType,
} from "@connext/types";
import { Zero, AddressZero } from "ethers/constants";

import { AppInstanceRepository } from "../appInstance/appInstance.repository";
import { SetStateCommitmentRepository } from "../setStateCommitment/setStateCommitment.repository";
import { WithdrawCommitmentRepository } from "../withdrawCommitment/withdrawCommitment.repository";
import { ConfigService } from "../config/config.service";
// eslint-disable-next-line max-len
import {
  ConditionalTransactionCommitmentRepository,
  convertConditionalCommitmentToJson,
} from "../conditionalCommitment/conditionalCommitment.repository";
import { ChannelRepository } from "../channel/channel.repository";
import { SetupCommitmentRepository } from "../setupCommitment/setupCommitment.repository";
import { xkeyKthAddress } from "../util";
import { AppInstance, AppType } from "../appInstance/appInstance.entity";
import { Channel } from "../channel/channel.entity";

@Injectable()
export class CFCoreStore implements IStoreService {
  private schemaVersion: number = STORE_SCHEMA_VERSION;
  constructor(
    private readonly channelRepository: ChannelRepository,
    private readonly appInstanceRepository: AppInstanceRepository,
    private readonly conditionalTransactionCommitmentRepository: ConditionalTransactionCommitmentRepository,
    private readonly setStateCommitmentRepository: SetStateCommitmentRepository,
    private readonly withdrawCommitmentRepository: WithdrawCommitmentRepository,
    private readonly configService: ConfigService,
    private readonly setupCommitmentRepository: SetupCommitmentRepository,
  ) {}

  getSchemaVersion(): Promise<number> {
    return Promise.resolve(this.schemaVersion);
  }

  updateSchemaVersion(): Promise<void> {
    throw new Error("Method not implemented");
  }

  async getAllChannels(): Promise<StateChannelJSON[]> {
    throw new Error("Method not implemented.");
  }

  getStateChannel(multisigAddress: string): Promise<StateChannelJSON> {
    return this.channelRepository.getStateChannel(multisigAddress);
  }

  getStateChannelByOwners(owners: string[]): Promise<StateChannelJSON> {
    return this.channelRepository.getStateChannelByOwners(owners);
  }

  getStateChannelByAppInstanceId(appInstanceId: string): Promise<StateChannelJSON> {
    return this.channelRepository.getStateChannelByAppInstanceId(appInstanceId);
  }

  async createStateChannel(stateChannel: StateChannelJSON): Promise<void> {
    const setup = await this.setupCommitmentRepository.findByMultisigAddressOrThrow(
      stateChannel.multisigAddress,
    );

    const nodePublicIdentifier = this.configService.getPublicIdentifier();
    const userPublicIdentifier = stateChannel.userNeuteredExtendedKeys.find(
      xpub => xpub !== this.configService.getPublicIdentifier(),
    );

    const { multisigAddress, addresses, freeBalanceAppInstance } = stateChannel;
    const channel = new Channel();
    channel.schemaVersion = this.schemaVersion;
    channel.userPublicIdentifier = userPublicIdentifier;
    channel.nodePublicIdentifier = nodePublicIdentifier;
    channel.multisigAddress = multisigAddress;
    channel.addresses = addresses;
    channel.monotonicNumProposedApps = 0;
    channel.setupCommitment = setup;

    const userFreeBalance = xkeyKthAddress(userPublicIdentifier);
    const userParticipantAddress = freeBalanceAppInstance.participants.find(
      p => p === userFreeBalance,
    );
    const nodeParticipantAddress = freeBalanceAppInstance.participants.find(
      p => p !== userFreeBalance,
    );
    const {
      identityHash,
      appInterface: { stateEncoding, actionEncoding, addr },
      outcomeType,
      latestState,
      latestTimeout,
      latestVersionNumber,
      appSeqNo,
    } = freeBalanceAppInstance;

    const freeBalanceApp = new AppInstance();
    freeBalanceApp.identityHash = identityHash;
    freeBalanceApp.stateEncoding = stateEncoding;
    freeBalanceApp.actionEncoding = actionEncoding;
    freeBalanceApp.appDefinition = addr;
    freeBalanceApp.appSeqNo = appSeqNo;
    freeBalanceApp.outcomeType = OutcomeType[outcomeType];
    freeBalanceApp.initialState = latestState as any;
    freeBalanceApp.initiatorDeposit = Zero;
    freeBalanceApp.initiatorDepositTokenAddress = AddressZero;
    freeBalanceApp.responderDeposit = Zero;
    freeBalanceApp.responderDepositTokenAddress = AddressZero;
    freeBalanceApp.timeout = latestTimeout;
    freeBalanceApp.latestVersionNumber = latestVersionNumber;
    freeBalanceApp.type = AppType.FREE_BALANCE;
    freeBalanceApp.proposedToIdentifier = userPublicIdentifier;
    freeBalanceApp.proposedByIdentifier = nodePublicIdentifier;
    freeBalanceApp.userParticipantAddress = userParticipantAddress;
    freeBalanceApp.nodeParticipantAddress = nodeParticipantAddress;

    channel.appInstances = [freeBalanceApp];
    await this.channelRepository.save(channel);
  }

  createLatestSetStateCommitment(
    appIdentityHash: string,
    commitment: SetStateCommitmentJSON,
  ): Promise<void> {
    throw new Error("Method not implemented.");
  }

  updateLatestSetStateCommitment(
    appIdentityHash: string,
    commitment: SetStateCommitmentJSON,
  ): Promise<void> {
    throw new Error("Method not implemented.");
  }

  async saveStateChannel(stateChannel: StateChannelJSON): Promise<void> {}

  getAppInstance(appInstanceId: string): Promise<AppInstanceJson> {
    return this.appInstanceRepository.getAppInstance(appInstanceId);
  }

  async createAppInstance(multisigAddress: string, appJson: AppInstanceJson): Promise<void> {
    throw new Error("Method not correctly implemented");
  }

  async updateAppInstance(multisigAddress: string, appJson: AppInstanceJson): Promise<void> {
    throw new Error("Method not correctly implemented");
  }

  // async saveAppInstance(multisigAddress: string, appJson: AppInstanceJson): Promise<void> {
  //   const channel = await this.channelRepository.findByMultisigAddressOrThrow(multisigAddress);
  //   await this.appInstanceRepository.saveAppInstance(channel, appJson);
  // }

  async removeAppInstance(multisigAddress: string, appInstanceId: string): Promise<void> {
    const app = await this.appInstanceRepository.findByIdentityHash(appInstanceId);
    if (!app) {
      throw new Error(`No app found when trying to remove. AppId: ${appInstanceId}`);
    }
    await this.appInstanceRepository.removeAppInstance(app);
  }

  getAppProposal(appInstanceId: string): Promise<AppInstanceProposal> {
    return this.appInstanceRepository.getAppProposal(appInstanceId);
  }

  async createAppProposal(
    multisigAddress: string,
    appProposal: AppInstanceProposal,
    numProposedApps: number,
  ): Promise<void> {
    throw new Error("Method not correctly implemented");
    // const channel = await this.channelRepository.findByMultisigAddressOrThrow(multisigAddress);
    // return this.appInstanceRepository.saveAppProposal(channel, appProposal);
  }

  async removeAppProposal(multisigAddress: string, appInstanceId: string): Promise<void> {
    // called in protocol during install and reject protocols
    // but we dont "remove" app proposals, they get upgraded. so
    // simply return without editing, and set the status to `REJECTED`
    // in the listener
  }

  getFreeBalance(multisigAddress: string): Promise<AppInstanceJson> {
    return this.appInstanceRepository.getFreeBalance(multisigAddress);
  }

  async createFreeBalance(multisigAddress: string, freeBalance: AppInstanceJson): Promise<void> {
    throw new Error("Method not correctly implemented");
  }

  async updateFreeBalance(multisigAddress: string, freeBalance: AppInstanceJson): Promise<void> {
    const channel = await this.channelRepository.findByMultisigAddressOrThrow(multisigAddress);
    await this.appInstanceRepository.saveFreeBalance(channel, freeBalance);
  }

  getSetupCommitment(multisigAddress: string): Promise<MinimalTransaction> {
    return this.setupCommitmentRepository.getCommitment(multisigAddress);
  }

  async createSetupCommitment(
    multisigAddress: string,
    commitment: MinimalTransaction,
  ): Promise<void> {
    // there may not be a channel at the time the setup commitment is
    // created, so add the multisig address
    const channel = await this.channelRepository.findByMultisigAddress(multisigAddress);
    await this.setupCommitmentRepository.saveCommitment(multisigAddress, commitment, channel);
  }

  getSetStateCommitment(appIdentityHash: string): Promise<SetStateCommitmentJSON | undefined> {
    return this.setStateCommitmentRepository.getLatestSetStateCommitment(appIdentityHash);
  }

  async createSetStateCommitment(
    appIdentityHash: string,
    commitment: SetStateCommitmentJSON,
  ): Promise<void> {
    const app = await this.appInstanceRepository.findByIdentityHash(appIdentityHash);
    if (!app) {
      throw new Error(`[saveLatestSetStateCommitment] Cannot find app with id: ${appIdentityHash}`);
    }
    return this.setStateCommitmentRepository.saveLatestSetStateCommitment(app, commitment);
  }

  updateSetStateCommitment(
    appIdentityHash: string,
    commitment: SetStateCommitmentJSON,
  ): Promise<void> {
    throw new Error("Method not correctly implemented");
  }

  async getConditionalTransactionCommitment(
    appIdentityHash: string,
  ): Promise<ConditionalTransactionCommitmentJSON | undefined> {
    const commitment = await this.conditionalTransactionCommitmentRepository.getConditionalTransactionCommitment(
      appIdentityHash,
    );
    if (!commitment) {
      return undefined;
    }
    return convertConditionalCommitmentToJson(
      commitment,
      await this.configService.getContractAddresses(),
    );
  }

  async createConditionalTransactionCommitment(
    appIdentityHash: string,
    commitment: ConditionalTransactionCommitmentJSON,
  ): Promise<void> {
    const app = await this.appInstanceRepository.findByIdentityHash(appIdentityHash);
    if (!app) {
      throw new Error(
        `Could not find appid for conditional transaction commitment. AppId: ${appIdentityHash}`,
      );
    }
    await this.conditionalTransactionCommitmentRepository.saveConditionalTransactionCommitment(
      app,
      commitment,
    );
  }

  async updateConditionalTransactionCommitment(
    appIdentityHash: string,
    commitment: ConditionalTransactionCommitmentJSON,
  ): Promise<void> {
    throw new Error("Method not implemented");
  }

  getWithdrawalCommitment(multisigAddress: string): Promise<MinimalTransaction> {
    return this.withdrawCommitmentRepository.getWithdrawalCommitmentTx(multisigAddress);
  }

  async createWithdrawalCommitment(
    multisigAddress: string,
    commitment: MinimalTransaction,
  ): Promise<void> {
    const channel = await this.channelRepository.findByMultisigAddress(multisigAddress);
    if (!channel) {
      throw new Error(`No channel found for withdrawal commitment, multisig: ${multisigAddress}`);
    }
    return this.withdrawCommitmentRepository.saveWithdrawalCommitment(channel, commitment);
  }

  async updateWithdrawalCommitment(
    multisigAddress: string,
    commitment: MinimalTransaction,
  ): Promise<void> {
    throw new Error("Method not implemented");
  }

  clear(): Promise<void> {
    throw new Error("Method not implemented.");
  }

  restore(): Promise<void> {
    throw new Error("Method not implemented.");
  }
}
