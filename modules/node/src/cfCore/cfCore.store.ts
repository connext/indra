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
  AppChallenge,
  StateProgressedContractEvent,
  ChallengeUpdatedContractEvent,
} from "@connext/types";
import { toBN } from "@connext/utils";
import { getManager } from "typeorm";
import { BigNumber, constants } from "ethers";

import { AppInstanceRepository } from "../appInstance/appInstance.repository";
import { SetStateCommitmentRepository } from "../setStateCommitment/setStateCommitment.repository";
import { WithdrawCommitmentRepository } from "../withdrawCommitment/withdrawCommitment.repository";
import { ConfigService } from "../config/config.service";
// eslint-disable-next-line max-len
import {
  ConditionalTransactionCommitmentRepository,
  convertConditionalCommitmentToJson,
} from "../conditionalCommitment/conditionalCommitment.repository";
import { ChannelRepository, convertChannelToJSON } from "../channel/channel.repository";
import { SetupCommitmentRepository } from "../setupCommitment/setupCommitment.repository";
import { AppInstance, AppType } from "../appInstance/appInstance.entity";
import { SetStateCommitment } from "../setStateCommitment/setStateCommitment.entity";
import { Channel } from "../channel/channel.entity";
import { ConditionalTransactionCommitment } from "../conditionalCommitment/conditionalCommitment.entity";
import { SetupCommitment } from "../setupCommitment/setupCommitment.entity";

@Injectable()
export class CFCoreStore implements IStoreService {
  private schemaVersion: number = STORE_SCHEMA_VERSION;
  constructor(
    private readonly channelRepository: ChannelRepository,
    private readonly appInstanceRepository: AppInstanceRepository,
    // eslint-disable-next-line max-len
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
    // called when setup commitment is created in protocol
    // managed node-side via migrations
    return Promise.resolve();
  }

  async getAllChannels(): Promise<StateChannelJSON[]> {
    const allChannels = await this.channelRepository.find();
    return allChannels.map((channel) => convertChannelToJSON(channel));
  }

  getChannel(multisig: string): Promise<Channel> {
    return this.channelRepository.findByMultisigAddressOrThrow(multisig);
  }

  getStateChannel(multisigAddress: string): Promise<StateChannelJSON> {
    return this.channelRepository.getStateChannel(multisigAddress);
  }

  getStateChannelByOwners(owners: string[]): Promise<StateChannelJSON> {
    return this.channelRepository.getStateChannelByOwners(owners);
  }

  getStateChannelByAppIdentityHash(appIdentityHash: string): Promise<StateChannelJSON> {
    return this.channelRepository.getStateChannelByAppIdentityHash(appIdentityHash);
  }

  async createStateChannel(
    stateChannel: StateChannelJSON,
    signedSetupCommitment: MinimalTransaction,
    signedFreeBalanceUpdate: SetStateCommitmentJSON,
  ): Promise<void> {
    const nodeIdentifier = this.configService.getPublicIdentifier();
    const userIdentifier = stateChannel.userIdentifiers.find((id) => id !== nodeIdentifier);

    const {
      multisigAddress,
      addresses,
      freeBalanceAppInstance,
      monotonicNumProposedApps,
    } = stateChannel;
    const channel = new Channel();
    channel.schemaVersion = this.schemaVersion;
    channel.userIdentifier = userIdentifier;
    channel.nodeIdentifier = nodeIdentifier;
    channel.multisigAddress = multisigAddress;
    channel.addresses = addresses;
    channel.monotonicNumProposedApps = monotonicNumProposedApps;
    const swaps = this.configService.getAllowedSwaps();
    let activeCollateralizations = {};
    swaps.forEach((swap) => {
      activeCollateralizations[swap.to] = false;
    });
    channel.activeCollateralizations = activeCollateralizations;

    const participants = [
      freeBalanceAppInstance.initiatorIdentifier,
      freeBalanceAppInstance.responderIdentifier,
    ];
    const userId = participants.find((p) => p === userIdentifier);
    const nodeId = participants.find((p) => p === nodeIdentifier);
    const {
      identityHash,
      appInterface: { stateEncoding, actionEncoding, addr },
      outcomeType,
      latestState,
      stateTimeout,
      defaultTimeout,
      latestVersionNumber,
      appSeqNo,
    } = freeBalanceAppInstance;

    const freeBalanceApp = new AppInstance();
    freeBalanceApp.identityHash = identityHash;
    freeBalanceApp.appDefinition = addr;
    freeBalanceApp.stateEncoding = stateEncoding;
    freeBalanceApp.actionEncoding = actionEncoding;
    freeBalanceApp.outcomeType = OutcomeType[outcomeType];
    freeBalanceApp.initialState = latestState as any;
    freeBalanceApp.appSeqNo = appSeqNo;
    freeBalanceApp.latestState = latestState as any;
    freeBalanceApp.latestVersionNumber = latestVersionNumber;
    freeBalanceApp.defaultTimeout = defaultTimeout;
    freeBalanceApp.stateTimeout = stateTimeout;

    // app proposal defaults
    freeBalanceApp.initiatorDeposit = constants.Zero;
    freeBalanceApp.initiatorDepositAssetId = constants.AddressZero;
    freeBalanceApp.responderDeposit = constants.Zero;
    freeBalanceApp.responderDepositAssetId = constants.AddressZero;
    freeBalanceApp.responderIdentifier = userIdentifier;
    freeBalanceApp.initiatorIdentifier = nodeIdentifier;
    freeBalanceApp.userIdentifier = userId;
    freeBalanceApp.nodeIdentifier = nodeId;
    freeBalanceApp.type = AppType.FREE_BALANCE;

    channel.appInstances = [freeBalanceApp];

    const setupCommitment = new SetupCommitment();
    setupCommitment.data = signedSetupCommitment.data;
    setupCommitment.to = signedSetupCommitment.to;
    setupCommitment.value = toBN(signedSetupCommitment.value);
    setupCommitment.multisigAddress = stateChannel.multisigAddress;

    channel.setupCommitment = setupCommitment;

    const freeBalanceUpdateCommitment = new SetStateCommitment();
    freeBalanceUpdateCommitment.app = freeBalanceApp;
    freeBalanceUpdateCommitment.appIdentity = signedFreeBalanceUpdate.appIdentity;
    freeBalanceUpdateCommitment.appStateHash = signedFreeBalanceUpdate.appStateHash;
    freeBalanceUpdateCommitment.challengeRegistryAddress =
      signedFreeBalanceUpdate.challengeRegistryAddress;
    freeBalanceUpdateCommitment.signatures = signedFreeBalanceUpdate.signatures;
    freeBalanceUpdateCommitment.stateTimeout = signedFreeBalanceUpdate.stateTimeout;
    freeBalanceUpdateCommitment.versionNumber = signedFreeBalanceUpdate.versionNumber;

    await getManager().transaction(async (transactionalEntityManager) => {
      await transactionalEntityManager.save(channel);
      await transactionalEntityManager.save(freeBalanceUpdateCommitment);
    });
  }

  getAppInstance(appIdentityHash: string): Promise<AppInstanceJson> {
    return this.appInstanceRepository.getAppInstance(appIdentityHash);
  }

  async createAppInstance(
    multisigAddress: string,
    appJson: AppInstanceJson,
    freeBalanceAppInstance: AppInstanceJson,
    signedFreeBalanceUpdate: SetStateCommitmentJSON,
    signedConditionalTxCommitment: ConditionalTransactionCommitmentJSON,
  ): Promise<void> {
    const {
      identityHash,
      initiatorIdentifier,
      responderIdentifier,
      latestState,
      stateTimeout,
      latestVersionNumber,
      meta,
      outcomeType,
      twoPartyOutcomeInterpreterParams,
      multiAssetMultiPartyCoinTransferInterpreterParams,
      singleAssetTwoPartyCoinTransferInterpreterParams,
    } = appJson;
    const proposal = await this.appInstanceRepository.findByIdentityHashOrThrow(identityHash);
    if (proposal.type !== AppType.PROPOSAL) {
      throw new Error(`Application already exists: ${appJson.identityHash}`);
    }

    // upgrade proposal to instance
    proposal.type = AppType.INSTANCE;
    // save user/node specific ids
    const nodeId = this.configService.getPublicIdentifier();
    proposal.userIdentifier = [initiatorIdentifier, responderIdentifier].find((p) => p !== nodeId);
    proposal.nodeIdentifier = [initiatorIdentifier, responderIdentifier].find((p) => p === nodeId);

    proposal.meta = meta;

    proposal.initialState = latestState;
    proposal.latestState = latestState;
    proposal.stateTimeout = stateTimeout;
    proposal.latestVersionNumber = latestVersionNumber;

    // interpreter params
    switch (OutcomeType[outcomeType]) {
      case OutcomeType.TWO_PARTY_FIXED_OUTCOME:
        proposal.outcomeInterpreterParameters = twoPartyOutcomeInterpreterParams;
        break;

      case OutcomeType.MULTI_ASSET_MULTI_PARTY_COIN_TRANSFER:
        proposal.outcomeInterpreterParameters = multiAssetMultiPartyCoinTransferInterpreterParams;
        break;

      case OutcomeType.SINGLE_ASSET_TWO_PARTY_COIN_TRANSFER:
        proposal.outcomeInterpreterParameters = singleAssetTwoPartyCoinTransferInterpreterParams;
        break;

      default:
        throw new Error(`Unrecognized outcome type: ${OutcomeType[proposal.outcomeType]}`);
    }
    await getManager().transaction(async (transactionalEntityManager) => {
      await transactionalEntityManager.save(proposal);
      await transactionalEntityManager
        .createQueryBuilder()
        .update(AppInstance)
        .set({
          latestState: freeBalanceAppInstance.latestState as any,
          stateTimeout: freeBalanceAppInstance.stateTimeout,
          latestVersionNumber: freeBalanceAppInstance.latestVersionNumber,
        })
        .where("identityHash = :identityHash", {
          identityHash: freeBalanceAppInstance.identityHash,
        })
        .execute();

      const subQuery = transactionalEntityManager
        .createQueryBuilder()
        .select("id")
        .from(AppInstance, "app")
        .where("app.identityHash = :appIdentityHash", {
          appIdentityHash: freeBalanceAppInstance.identityHash,
        });
      await transactionalEntityManager
        .createQueryBuilder()
        .update(SetStateCommitment)
        .set({
          appIdentity: signedFreeBalanceUpdate.appIdentity,
          appStateHash: signedFreeBalanceUpdate.appStateHash,
          challengeRegistryAddress: signedFreeBalanceUpdate.challengeRegistryAddress,
          signatures: signedFreeBalanceUpdate.signatures,
          stateTimeout: signedFreeBalanceUpdate.stateTimeout,
          versionNumber: signedFreeBalanceUpdate.versionNumber,
        })
        .where('"appId" = (' + subQuery.getQuery() + ")")
        .setParameters(subQuery.getParameters())
        .execute();

      await transactionalEntityManager
        .createQueryBuilder()
        .insert()
        .into(ConditionalTransactionCommitment)
        .values({
          freeBalanceAppIdentityHash: signedConditionalTxCommitment.freeBalanceAppIdentityHash,
          multisigAddress: signedConditionalTxCommitment.multisigAddress,
          multisigOwners: signedConditionalTxCommitment.multisigOwners,
          interpreterAddr: signedConditionalTxCommitment.interpreterAddr,
          interpreterParams: signedConditionalTxCommitment.interpreterParams,
          signatures: signedConditionalTxCommitment.signatures,
          app: proposal,
        })
        .execute();
    });
  }

  async updateAppInstance(
    multisigAddress: string,
    appJson: AppInstanceJson,
    signedSetStateCommitment: SetStateCommitmentJSON,
  ): Promise<void> {
    const { identityHash, latestState, stateTimeout, latestVersionNumber } = appJson;
    const app = await this.appInstanceRepository.findByIdentityHash(identityHash);

    if (!app) {
      throw new Error(`No app found when trying to update. AppId: ${identityHash}`);
    }

    if (app.type !== AppType.INSTANCE && app.type !== AppType.FREE_BALANCE) {
      throw new Error(`App is not of correct type, type: ${app.type}`);
    }

    await getManager().transaction(async (transactionalEntityManager) => {
      await transactionalEntityManager
        .createQueryBuilder()
        .update(AppInstance)
        .set({
          latestState: latestState as any,
          stateTimeout,
          latestVersionNumber,
        })
        .where("identityHash = :identityHash", { identityHash })
        .execute();

      const subQuery = transactionalEntityManager
        .createQueryBuilder()
        .select("id")
        .from(AppInstance, "app")
        .where("app.identityHash = :appIdentityHash", {
          appIdentityHash: signedSetStateCommitment.appIdentityHash,
        });
      await transactionalEntityManager
        .createQueryBuilder()
        .update(SetStateCommitment)
        .set({
          appIdentity: signedSetStateCommitment.appIdentity,
          appStateHash: signedSetStateCommitment.appStateHash,
          challengeRegistryAddress: signedSetStateCommitment.challengeRegistryAddress,
          signatures: signedSetStateCommitment.signatures,
          stateTimeout: signedSetStateCommitment.stateTimeout,
          versionNumber: signedSetStateCommitment.versionNumber,
        })
        .where('"appId" = (' + subQuery.getQuery() + ")")
        .setParameters(subQuery.getParameters())
        .execute();
    });
  }

  async removeAppInstance(
    multisigAddress: string,
    appIdentityHash: string,
    freeBalanceAppInstance: AppInstanceJson,
    signedFreeBalanceUpdate: SetStateCommitmentJSON,
  ): Promise<void> {
    const app = await this.appInstanceRepository.findByIdentityHash(appIdentityHash);
    if (!app) {
      throw new Error(`No app found when trying to remove. AppId: ${appIdentityHash}`);
    }
    if (app.type !== AppType.INSTANCE) {
      throw new Error(`App is not of correct type`);
    }
    app.type = AppType.UNINSTALLED;

    const channelId = app.channel.id;
    app.channel = null;

    await getManager().transaction(async (transactionalEntityManager) => {
      await transactionalEntityManager.save(app);
      await transactionalEntityManager
        .createQueryBuilder()
        .update(AppInstance)
        .set({
          latestState: freeBalanceAppInstance.latestState as any,
          stateTimeout: freeBalanceAppInstance.stateTimeout,
          latestVersionNumber: freeBalanceAppInstance.latestVersionNumber,
        })
        .where("identityHash = :identityHash", {
          identityHash: freeBalanceAppInstance.identityHash,
        })
        .execute();
      await transactionalEntityManager
        .createQueryBuilder()
        .relation(Channel, "appInstances")
        .of(channelId)
        .remove(app.id);

      const subQuery = transactionalEntityManager
        .createQueryBuilder()
        .select("id")
        .from(AppInstance, "app")
        .where("app.identityHash = :appIdentityHash", {
          appIdentityHash: freeBalanceAppInstance.identityHash,
        });
      await transactionalEntityManager
        .createQueryBuilder()
        .update(SetStateCommitment)
        .set({
          appIdentity: signedFreeBalanceUpdate.appIdentity,
          appStateHash: signedFreeBalanceUpdate.appStateHash,
          challengeRegistryAddress: signedFreeBalanceUpdate.challengeRegistryAddress,
          signatures: signedFreeBalanceUpdate.signatures,
          stateTimeout: signedFreeBalanceUpdate.stateTimeout,
          versionNumber: signedFreeBalanceUpdate.versionNumber,
        })
        .where('"appId" = (' + subQuery.getQuery() + ")")
        .setParameters(subQuery.getParameters())
        .execute();
    });
  }

  getAppProposal(appIdentityHash: string): Promise<AppInstanceProposal> {
    return this.appInstanceRepository.getAppProposal(appIdentityHash);
  }

  async createAppProposal(
    multisigAddress: string,
    appProposal: AppInstanceProposal,
    numProposedApps: number,
    signedSetStateCommitment: SetStateCommitmentJSON,
  ): Promise<void> {
    const channel = await this.channelRepository.findByMultisigAddressOrThrow(multisigAddress);

    const app = new AppInstance();
    app.type = AppType.PROPOSAL;
    app.identityHash = appProposal.identityHash;
    app.actionEncoding = appProposal.abiEncodings.actionEncoding;
    app.stateEncoding = appProposal.abiEncodings.stateEncoding;
    app.appDefinition = appProposal.appDefinition;
    app.appSeqNo = appProposal.appSeqNo;
    app.initiatorDeposit = BigNumber.from(appProposal.initiatorDeposit);
    app.initiatorDepositAssetId = appProposal.initiatorDepositAssetId;
    app.responderDeposit = BigNumber.from(appProposal.responderDeposit);
    app.responderDepositAssetId = appProposal.responderDepositAssetId;
    app.defaultTimeout = appProposal.defaultTimeout;
    app.stateTimeout = appProposal.stateTimeout;
    app.responderIdentifier = appProposal.responderIdentifier;
    app.initiatorIdentifier = appProposal.initiatorIdentifier;
    app.outcomeType = appProposal.outcomeType;
    app.meta = appProposal.meta;
    app.initialState = appProposal.initialState;
    app.latestState = appProposal.initialState;
    app.latestVersionNumber = 0;
    app.channel = channel;

    const setStateCommitment = new SetStateCommitment();
    setStateCommitment.app = app;
    setStateCommitment.appIdentity = signedSetStateCommitment.appIdentity;
    setStateCommitment.appStateHash = signedSetStateCommitment.appStateHash;
    setStateCommitment.challengeRegistryAddress = signedSetStateCommitment.challengeRegistryAddress;
    setStateCommitment.signatures = signedSetStateCommitment.signatures;
    setStateCommitment.stateTimeout = signedSetStateCommitment.stateTimeout;
    setStateCommitment.versionNumber = signedSetStateCommitment.versionNumber;

    // because the app instance has `cascade` set to true, saving
    // the channel will involve multiple queries and should be put
    // within a transaction
    await getManager().transaction(async (transactionalEntityManager) => {
      await transactionalEntityManager.save(app);
      await transactionalEntityManager.save(setStateCommitment);

      await transactionalEntityManager
        .createQueryBuilder()
        .update(Channel)
        .set({
          monotonicNumProposedApps: numProposedApps,
        })
        .where("multisigAddress = :multisigAddress", { multisigAddress })
        .execute();

      await transactionalEntityManager
        .createQueryBuilder()
        .relation(Channel, "appInstances")
        .of(channel.id)
        .add(app.id);
    });
  }

  async removeAppProposal(multisigAddress: string, appIdentityHash: string): Promise<void> {
    // called in protocol during install and reject protocols
    // but we dont "remove" app proposals, they get upgraded. so
    // simply return without editing, and set the status to `REJECTED`
    // in the listener
    const app = await this.appInstanceRepository.findByIdentityHash(appIdentityHash);
    if (!app || app.type !== AppType.PROPOSAL) {
      return;
    }
    app.type = AppType.REJECTED;

    const channelId = app.channel.id;
    app.channel = undefined;
    await getManager().transaction(async (transactionalEntityManager) => {
      await transactionalEntityManager.save(app);
      await transactionalEntityManager
        .createQueryBuilder()
        .relation(Channel, "appInstances")
        .of(channelId)
        .remove(app.id);
    });
  }

  getFreeBalance(multisigAddress: string): Promise<AppInstanceJson> {
    return this.appInstanceRepository.getFreeBalance(multisigAddress);
  }

  async updateFreeBalance(
    multisigAddress: string,
    freeBalanceAppInstance: AppInstanceJson,
  ): Promise<void> {
    await this.updateAppInstance(multisigAddress, freeBalanceAppInstance, {} as any);
  }

  getSetupCommitment(multisigAddress: string): Promise<MinimalTransaction> {
    return this.setupCommitmentRepository.getCommitment(multisigAddress);
  }

  getSetStateCommitment(appIdentityHash: string): Promise<SetStateCommitmentJSON | undefined> {
    return this.setStateCommitmentRepository.getLatestSetStateCommitment(appIdentityHash);
  }

  async getConditionalTransactionCommitment(
    appIdentityHash: string,
  ): Promise<ConditionalTransactionCommitmentJSON | undefined> {
    const commitment = await this.conditionalTransactionCommitmentRepository.findByAppIdentityHash(
      appIdentityHash,
    );
    return (
      commitment &&
      convertConditionalCommitmentToJson(
        commitment,
        await this.configService.getContractAddresses(),
      )
    );
  }

  getWithdrawalCommitment(multisigAddress: string): Promise<MinimalTransaction> {
    return this.withdrawCommitmentRepository.getWithdrawalCommitmentTx(multisigAddress);
  }

  clear(): Promise<void> {
    throw new Error("Method not implemented.");
  }

  restore(): Promise<void> {
    throw new Error("Method not implemented.");
  }

  ////// Watcher methods
  async getAppChallenge(appIdentityHash: string): Promise<AppChallenge | undefined> {
    throw new Error("Disputes not implememented");
  }

  async createAppChallenge(multisigAddress: string, appChallenge: AppChallenge): Promise<void> {
    throw new Error("Disputes not implememented");
  }

  async updateAppChallenge(multisigAddress: string, appChallenge: AppChallenge): Promise<void> {
    throw new Error("Disputes not implememented");
  }

  ///// Events
  async getLatestProcessedBlock(): Promise<number> {
    throw new Error("Disputes not implememented");
  }

  async createLatestProcessedBlock(): Promise<void> {
    throw new Error("Disputes not implememented");
  }

  async updateLatestProcessedBlock(blockNumber: number): Promise<void> {
    throw new Error("Disputes not implememented");
  }

  async getStateProgressedEvent(
    appIdentityHash: string,
  ): Promise<StateProgressedContractEvent | undefined> {
    throw new Error("Disputes not implememented");
  }

  async createStateProgressedEvent(
    multisigAddress: string,
    appChallenge: StateProgressedContractEvent,
  ): Promise<void> {
    throw new Error("Disputes not implememented");
  }

  async updateStateProgressedEvent(
    multisigAddress: string,
    appChallenge: StateProgressedContractEvent,
  ): Promise<void> {
    throw new Error("Disputes not implememented");
  }

  async getChallengeUpdatedEvent(
    appIdentityHash: string,
  ): Promise<ChallengeUpdatedContractEvent | undefined> {
    throw new Error("Disputes not implememented");
  }

  async createChallengeUpdatedEvent(
    multisigAddress: string,
    event: ChallengeUpdatedContractEvent,
  ): Promise<void> {
    throw new Error("Disputes not implememented");
  }

  async updateChallengeUpdatedEvent(
    multisigAddress: string,
    appChallenge: ChallengeUpdatedContractEvent,
  ): Promise<void> {
    throw new Error("Disputes not implememented");
  }
}
