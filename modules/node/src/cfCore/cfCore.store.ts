import { Injectable } from "@nestjs/common";
import {
  ConditionalTransactionCommitmentJSON,
  IStoreService,
  SetStateCommitmentJSON,
  StateChannelJSON,
  AppInstanceJson,
  ProtocolTypes,
} from "@connext/types";

import { AppInstance, AppType } from "../appInstance/appInstance.entity";
import { AppInstanceRepository } from "../appInstance/appInstance.repository";
import {
  ConditionalTransactionCommitmentRepository,
  SetStateCommitmentRepository,
  WithdrawCommitmentRepository,
} from "../commitment/commitment.repository";
import { Channel } from "../channel/channel.entity";
import { ChannelRepository } from "../channel/channel.repository";

@Injectable()
export class CFCoreStore implements IStoreService {
  constructor(
    private readonly channelRepository: ChannelRepository,
    private readonly appInstanceRepository: AppInstanceRepository,
    private readonly conditionalTransactionCommitmentRepository: ConditionalTransactionCommitmentRepository,
    private readonly setStateCommitmentRepository: SetStateCommitmentRepository,
    private readonly withdrawCommitmentRepository: WithdrawCommitmentRepository,
  ) {}

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
    if (!channel) {
      channel = new Channel();
    }
    channel.multisigAddress = stateChannel.multisigAddress;

    // assemble proposed apps
    const proposedApps = await Promise.all(
      stateChannel.proposedAppInstances.map(async ([identityHash, appJson]) => {
        let app = await this.appInstanceRepository.findByIdentityHash(identityHash);
        if (!app) {
          app = new AppInstance();
          app.identityHash = identityHash;
        }
        app.abiEncodings = appJson.abiEncodings;
        app.appDefinition = appJson.appDefinition;
        app.appSeqNo = appJson.appSeqNo;
        app.initialState = appJson.initialState;
        app.initiatorDeposit = appJson.initiatorDeposit;
        app.initiatorDepositTokenAddress = appJson.initiatorDepositTokenAddress;
        app.responderDeposit = appJson.responderDeposit;
        app.responderDepositTokenAddress = appJson.responderDepositTokenAddress;
        app.timeout = appJson.timeout;
        app.proposedToIdentifier = appJson.proposedToIdentifier;
        app.proposedByIdentifier = appJson.proposedByIdentifier;
        app.outcomeType = appJson.outcomeType;
        app.type = AppType.PROPOSAL;

        app.channel = channel;
        return app;
      }),
    );
    channel.proposedAppInstances = proposedApps;

    // assemble installed apps
    const installedApps = await Promise.all(
      stateChannel.appInstances.map(async ([identityHash, appJson]) => {
        let app = await this.appInstanceRepository.findByIdentityHash(identityHash);
        if (!app) {
          app = new AppInstance();
          app.identityHash = identityHash;
        }
        app.appSeqNo = appJson.appSeqNo;
        app.latestState = appJson.latestState;
        app.latestTimeout = appJson.latestTimeout;
        app.latestVersionNumber = appJson.latestVersionNumber;

        // TODO: everything else should already be in from the proposal, verify this

        app.channel = channel;
        return app;
      }),
    );
    channel.appInstances = installedApps;
  }

  getAppInstance(appInstanceId: string): Promise<AppInstanceJson> {
    return this.appInstanceRepository.getAppInstance(appInstanceId);
  }

  saveAppInstance(multisigAddress: string, appInstance: AppInstanceJson): Promise<void> {
    throw new Error("Method not implemented.");
  }

  getLatestSetStateCommitment(
    appIdentityHash: string,
  ): Promise<SetStateCommitmentJSON | undefined> {
    return this.setStateCommitmentRepository.getLatestSetStateCommitment(appIdentityHash);
  }

  saveLatestSetStateCommitment(
    appIdentityHash: string,
    commitment: SetStateCommitmentJSON,
  ): Promise<void> {
    return this.setStateCommitmentRepository.saveLatestSetStateCommitment(
      appIdentityHash,
      commitment,
    );
  }

  getConditionalTransactionCommitment(
    appIdentityHash: string,
  ): Promise<ConditionalTransactionCommitmentJSON | undefined> {
    return this.conditionalTransactionCommitmentRepository.getConditionalTransactionCommitment(
      appIdentityHash,
    );
  }

  saveConditionalTransactionCommitment(
    appIdentityHash: string,
    commitment: ConditionalTransactionCommitmentJSON,
  ): Promise<void> {
    return this.conditionalTransactionCommitmentRepository.saveConditionalTransactionCommitment(
      appIdentityHash,
      commitment,
    );
  }

  getWithdrawalCommitment(multisigAddress: string): Promise<ProtocolTypes.MinimalTransaction> {
    return this.withdrawCommitmentRepository.getWithdrawalCommitment(multisigAddress);
  }

  saveWithdrawalCommitment(
    multisigAddress: string,
    commitment: ProtocolTypes.MinimalTransaction,
  ): Promise<void> {
    return this.withdrawCommitmentRepository.saveWithdrawalCommitment(multisigAddress, commitment);
  }

  getExtendedPrvKey(): Promise<string> {
    throw new Error("Method not implemented.");
  }

  saveExtendedPrvKey(extendedPrvKey: string): Promise<void> {
    throw new Error("Method not implemented.");
  }

  clear(): Promise<void> {
    throw new Error("Method not implemented.");
  }

  restore(): Promise<void> {
    throw new Error("Method not implemented.");
  }
}
