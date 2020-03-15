import { Injectable } from "@nestjs/common";
import {
  ConditionalTransactionCommitmentJSON,
  IStoreService,
  SetStateCommitmentJSON,
  StateChannelJSON,
  AppInstanceJson,
  AppInstanceProposal,
  ProtocolTypes,
  STORE_SCHEMA_VERSION,
} from "@connext/types";

import { AppInstanceRepository } from "../appInstance/appInstance.repository";
import { SetStateCommitmentRepository } from "../setStateCommitment/setStateCommitment.repository";
import { WithdrawCommitmentRepository } from "../withdrawCommitment/withdrawCommitment.repository";
// eslint-disable-next-line max-len
import {
  ConditionalTransactionCommitmentRepository,
  convertConditionalCommitmentToJson,
} from "../conditionalCommitment/conditionalCommitment.repository";
import { Channel } from "../channel/channel.entity";
import { ChannelRepository } from "../channel/channel.repository";
import { ConfigService } from "../config/config.service";
import { SetupCommitmentEntityRepository } from "../setupCommitment/setupCommitment.repository";

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
    private readonly setupCommitmentRepository: SetupCommitmentEntityRepository,
  ) {}

  getSchemaVersion(): number {
    return this.schemaVersion;
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

  async saveStateChannel(stateChannel: StateChannelJSON): Promise<void> {
    let channel = await this.channelRepository.findByMultisigAddress(stateChannel.multisigAddress);
    const setup = await this.setupCommitmentRepository.findByMultisigAddress(
      stateChannel.multisigAddress,
    );
    if (!channel) {
      if (!setup) {
        throw new Error(`No setup commitment found for multisig ${stateChannel.multisigAddress}`);
      }
      // update fields that should only be touched on creation
      channel = new Channel();
      channel.schemaVersion = this.schemaVersion;
      channel.nodePublicIdentifier = this.configService.getPublicIdentifier();
      channel.userPublicIdentifier = stateChannel.userNeuteredExtendedKeys.filter(
        xpub => xpub !== this.configService.getPublicIdentifier(),
      )[0];
      channel.multisigAddress = stateChannel.multisigAddress;
      channel.addresses = stateChannel.addresses;
    }
    // update nonce
    channel.monotonicNumProposedApps = stateChannel.monotonicNumProposedApps;
    const chan = await this.channelRepository.save(channel);
    // if there was a setup commitment without a channel, resave
    if (setup.channel) {
      return;
    }
    setup.channel = chan;
    await this.setupCommitmentRepository.save(setup);
  }

  getAppInstance(appInstanceId: string): Promise<AppInstanceJson> {
    return this.appInstanceRepository.getAppInstance(appInstanceId);
  }

  async saveAppInstance(multisigAddress: string, appJson: AppInstanceJson): Promise<void> {
    const channel = await this.channelRepository.findByMultisigAddressOrThrow(multisigAddress);
    await this.appInstanceRepository.saveAppInstance(channel, appJson);
  }

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

  async saveAppProposal(multisigAddress: string, appProposal: AppInstanceProposal): Promise<void> {
    const channel = await this.channelRepository.findByMultisigAddressOrThrow(multisigAddress);
    return this.appInstanceRepository.saveAppProposal(channel, appProposal);
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

  async saveFreeBalance(multisigAddress: string, freeBalance: AppInstanceJson): Promise<void> {
    const channel = await this.channelRepository.findByMultisigAddressOrThrow(multisigAddress);
    await this.appInstanceRepository.saveFreeBalance(channel, freeBalance);
  }

  getLatestSetStateCommitment(
    appIdentityHash: string,
  ): Promise<SetStateCommitmentJSON | undefined> {
    return this.setStateCommitmentRepository.getLatestSetStateCommitment(appIdentityHash);
  }

  async saveLatestSetStateCommitment(
    appIdentityHash: string,
    commitment: SetStateCommitmentJSON,
  ): Promise<void> {
    const app = await this.appInstanceRepository.findByIdentityHash(appIdentityHash);
    if (!app) {
      throw new Error(`[saveLatestSetStateCommitment] Cannot find app with id: ${appIdentityHash}`);
    }
    return this.setStateCommitmentRepository.saveLatestSetStateCommitment(app, commitment);
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

  async saveConditionalTransactionCommitment(
    appIdentityHash: string,
    commitment: ConditionalTransactionCommitmentJSON,
  ): Promise<void> {
    const app = await this.appInstanceRepository.findByIdentityHash(appIdentityHash);
    if (!app) {
      throw Error(
        `Could not find appid for conditional transaction commitment. AppId: ${appIdentityHash}`,
      );
    }
    await this.conditionalTransactionCommitmentRepository.saveConditionalTransactionCommitment(
      app,
      commitment,
    );
  }

  getWithdrawalCommitment(multisigAddress: string): Promise<ProtocolTypes.MinimalTransaction> {
    return this.withdrawCommitmentRepository.getWithdrawalCommitmentTx(multisigAddress);
  }

  async saveWithdrawalCommitment(
    multisigAddress: string,
    commitment: ProtocolTypes.MinimalTransaction,
  ): Promise<void> {
    const channel = await this.channelRepository.findByMultisigAddress(multisigAddress);
    if (!channel) {
      throw new Error(`No channel found for withdrawal commitment, multisig: ${multisigAddress}`);
    }
    return this.withdrawCommitmentRepository.saveWithdrawalCommitment(channel, commitment);
  }

  getSetupCommitment(multisigAddress: string): Promise<ProtocolTypes.MinimalTransaction> {
    return this.setupCommitmentRepository.getCommitment(multisigAddress);
  }

  async saveSetupCommitment(
    multisigAddress: string,
    commitment: ProtocolTypes.MinimalTransaction,
  ): Promise<void> {
    // there may not be a channel at the time the setup commitment is
    // created, so add the multisig address
    const channel = await this.channelRepository.findByMultisigAddress(multisigAddress);
    await this.setupCommitmentRepository.saveCommitment(multisigAddress, commitment, channel);
  }

  clear(): Promise<void> {
    throw new Error("Method not implemented.");
  }

  restore(): Promise<void> {
    throw new Error("Method not implemented.");
  }
}
