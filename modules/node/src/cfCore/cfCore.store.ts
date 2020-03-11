import { Injectable } from "@nestjs/common";
import {
  ConditionalTransactionCommitmentJSON,
  IStoreService,
  SetStateCommitmentJSON,
  StateChannelJSON,
  AppInstanceJson,
  ProtocolTypes,
  STORE_SCHEMA_VERSION,
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
import { ConfigService } from "../config/config.service";
import { OutcomeType } from "../util";
import { Zero, AddressZero } from "ethers/constants";
import { bigNumberify } from "ethers/utils";

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
    if (!channel) {
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
    // update all other fields
    // nonce
    channel.monotonicNumProposedApps = stateChannel.monotonicNumProposedApps;
    /////////////////////////////
    // single asset two party intermediary agreements
    channel.singleAssetTwoPartyIntermediaryAgreements =
      stateChannel.singleAssetTwoPartyIntermediaryAgreements || [];

    /////////////////////////////
    // free balance
    let freeBalanceSaved = await this.appInstanceRepository.findByIdentityHash(
      stateChannel.freeBalanceAppInstance.identityHash,
    );
    const { freeBalanceAppInstance: freeBalanceData } = stateChannel;
    if (!freeBalanceSaved) {
      freeBalanceSaved = new AppInstance();
      freeBalanceSaved.identityHash = freeBalanceData.identityHash;
      freeBalanceSaved.type = AppType.FREE_BALANCE;
      freeBalanceSaved.abiEncodings = {
        stateEncoding: freeBalanceData.appInterface.stateEncoding,
        actionEncoding: freeBalanceData.appInterface.actionEncoding,
      };
      freeBalanceSaved.appDefinition = freeBalanceData.appInterface.addr;
      freeBalanceSaved.appSeqNo = freeBalanceData.appSeqNo;
      freeBalanceSaved.channel = channel;
      freeBalanceSaved.outcomeType = OutcomeType[freeBalanceData.outcomeType];
      // new instance, save initial state as latest
      freeBalanceSaved.initialState = freeBalanceData.latestState;
      freeBalanceSaved.participants = freeBalanceData.participants;
      // TODO: proper way to add these since free balance does not go thorugh
      // propose flow
      freeBalanceSaved.initiatorDeposit = Zero;
      freeBalanceSaved.initiatorDepositTokenAddress = AddressZero;
      freeBalanceSaved.responderDeposit = Zero;
      freeBalanceSaved.responderDepositTokenAddress = AddressZero;
      freeBalanceSaved.proposedToIdentifier = channel.userPublicIdentifier;
      freeBalanceSaved.proposedByIdentifier = channel.nodePublicIdentifier;
      freeBalanceSaved.timeout = freeBalanceData.latestTimeout;

      // interpreter params
      freeBalanceSaved.multiAssetMultiPartyCoinTransferInterpreterParams =
        freeBalanceData.multiAssetMultiPartyCoinTransferInterpreterParams;

      freeBalanceSaved.singleAssetTwoPartyCoinTransferInterpreterParams =
        freeBalanceData.singleAssetTwoPartyCoinTransferInterpreterParams;

      freeBalanceSaved.twoPartyOutcomeInterpreterParams =
        freeBalanceData.twoPartyOutcomeInterpreterParams;
    }
    freeBalanceSaved.latestState = freeBalanceData.latestState;
    freeBalanceSaved.latestTimeout = freeBalanceData.latestTimeout;
    freeBalanceSaved.latestVersionNumber = freeBalanceData.latestVersionNumber;

    /////////////////////////////
    // assemble proposed apps
    const proposedApps: AppInstance[] = await Promise.all(
      stateChannel.proposedAppInstances.map(async ([identityHash, appJson]) => {
        let app = await this.appInstanceRepository.findByIdentityHash(identityHash);
        if (app && app.type === AppType.PROPOSAL) {
          return app;
        }
        app = new AppInstance();
        app.identityHash = identityHash;
        app.abiEncodings = appJson.abiEncodings;
        app.appDefinition = appJson.appDefinition;
        app.appSeqNo = appJson.appSeqNo;
        app.initialState = appJson.initialState;
        app.initiatorDeposit = bigNumberify(appJson.initiatorDeposit);
        app.initiatorDepositTokenAddress = appJson.initiatorDepositTokenAddress;
        app.latestState = appJson.initialState;
        app.latestTimeout = bigNumberify(appJson.timeout).toNumber();
        app.latestVersionNumber = 0;
        app.responderDeposit = bigNumberify(appJson.responderDeposit);
        app.responderDepositTokenAddress = appJson.responderDepositTokenAddress;
        app.timeout = bigNumberify(appJson.timeout).toNumber();
        app.proposedToIdentifier = appJson.proposedToIdentifier;
        app.proposedByIdentifier = appJson.proposedByIdentifier;
        app.outcomeType = appJson.outcomeType;
        app.type = AppType.PROPOSAL;

        app.channel = channel;
        return app;
      }),
    );

    /////////////////////////////
    // assemble installed apps
    const installedApps: AppInstance[] = await Promise.all(
      stateChannel.appInstances.map(async ([identityHash, appJson]) => {
        let app = await this.appInstanceRepository.findByIdentityHash(identityHash);
        if (!app) {
          throw new Error(`Did not find app with identity hash: ${identityHash}`);
        }
        if (
          app.type === AppType.INSTANCE &&
          app.latestVersionNumber === appJson.latestVersionNumber
        ) {
          // app was not updated, return app
          return app;
        }
        if (app.type === AppType.PROPOSAL) {
          app.type = AppType.INSTANCE;
          app.participants = appJson.participants;
        }
        app.latestState = appJson.latestState;
        app.latestTimeout = appJson.latestTimeout;
        app.latestVersionNumber = appJson.latestVersionNumber;

        // TODO: everything else should already be in from the proposal, verify this
        return app;
      }),
    );
    channel.appInstances = [freeBalanceSaved]
      .concat(installedApps.filter(x => !!x))
      .concat(proposedApps.filter(x => !!x));

    await this.channelRepository.save(channel);
  }

  getAppInstance(appInstanceId: string): Promise<AppInstanceJson> {
    return this.appInstanceRepository.getAppInstance(appInstanceId);
  }

  saveAppInstance(multisigAddress: string, appJson: AppInstanceJson): Promise<void> {
    throw new Error("Method not implemented.");
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
