import { Injectable } from "@nestjs/common";
import {
  AppInstanceJson,
  AppState,
  ChallengeEvents,
  ChallengeStatus,
  ChallengeUpdatedEventPayload,
  ConditionalTransactionCommitmentJSON,
  Contract,
  IStoreService,
  JsonRpcProvider,
  MinimalTransaction,
  OutcomeType,
  SetStateCommitmentJSON,
  StateChannelJSON,
  StateProgressedEventPayload,
  STORE_SCHEMA_VERSION,
  StoredAppChallenge,
  StoredAppChallengeStatus,
  WithdrawalMonitorObject,
} from "@connext/types";
import { toBN, getSignerAddressFromPublicIdentifier, stringify } from "@connext/utils";
import { getManager } from "typeorm";
import { constants, utils } from "ethers";

import { AppInstanceRepository } from "../appInstance/appInstance.repository";
import {
  SetStateCommitmentRepository,
  setStateToJson,
} from "../setStateCommitment/setStateCommitment.repository";
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
import {
  entityToStoredChallenge,
  ChallengeRepository,
  ProcessedBlockRepository,
} from "../challenge/challenge.repository";
import { Challenge, ProcessedBlock } from "../challenge/challenge.entity";
import {
  entityToStateProgressedEventPayload,
  StateProgressedEvent,
} from "../stateProgressedEvent/stateProgressedEvent.entity";
import {
  entityToChallengeUpdatedPayload,
  ChallengeUpdatedEvent,
} from "../challengeUpdatedEvent/challengeUpdatedEvent.entity";
import { SetupCommitment } from "../setupCommitment/setupCommitment.entity";
import { ChallengeRegistry } from "@connext/contracts";
import { LoggerService } from "../logger/logger.service";

const { Zero, AddressZero } = constants;
const { bigNumberify, defaultAbiCoder } = utils;

@Injectable()
export class CFCoreStore implements IStoreService {
  private schemaVersion: number = STORE_SCHEMA_VERSION;
  constructor(
    private readonly log: LoggerService,
    private readonly channelRepository: ChannelRepository,
    private readonly appInstanceRepository: AppInstanceRepository,
    // eslint-disable-next-line max-len
    private readonly conditionalTransactionCommitmentRepository: ConditionalTransactionCommitmentRepository,
    private readonly setStateCommitmentRepository: SetStateCommitmentRepository,
    private readonly configService: ConfigService,
    private readonly setupCommitmentRepository: SetupCommitmentRepository,
    private readonly challengeRepository: ChallengeRepository,
    private readonly processedBlockRepository: ProcessedBlockRepository,
  ) {
    log.setContext("CFCoreStore");
  }

  init(): Promise<void> {
    return Promise.resolve();
  }

  close(): Promise<void> {
    return Promise.resolve();
  }

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
    channel.multisigAddress = multisigAddress;
    channel.schemaVersion = this.schemaVersion;
    channel.userIdentifier = userIdentifier;
    channel.nodeIdentifier = nodeIdentifier;
    channel.addresses = addresses;
    channel.monotonicNumProposedApps = monotonicNumProposedApps;
    const swaps = this.configService.getAllowedSwaps();
    const activeCollateralizations = {};
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
      abiEncodings: { stateEncoding, actionEncoding },
      outcomeType,
      latestState,
      stateTimeout,
      defaultTimeout,
      latestVersionNumber,
      appSeqNo,
      appDefinition,
      outcomeInterpreterParameters,
    } = freeBalanceAppInstance;

    const freeBalanceApp = new AppInstance();
    freeBalanceApp.identityHash = identityHash;
    freeBalanceApp.appDefinition = appDefinition;
    freeBalanceApp.stateEncoding = stateEncoding;
    freeBalanceApp.actionEncoding = actionEncoding;
    freeBalanceApp.outcomeType = OutcomeType[outcomeType];
    freeBalanceApp.appSeqNo = appSeqNo;
    freeBalanceApp.latestState = latestState as any;
    freeBalanceApp.latestVersionNumber = latestVersionNumber;
    freeBalanceApp.defaultTimeout = defaultTimeout;
    freeBalanceApp.stateTimeout = stateTimeout;

    // app proposal defaults
    freeBalanceApp.initiatorDeposit = Zero;
    freeBalanceApp.initiatorDepositAssetId = AddressZero;
    freeBalanceApp.responderDeposit = Zero;
    freeBalanceApp.responderDepositAssetId = AddressZero;
    freeBalanceApp.responderIdentifier = userIdentifier;
    freeBalanceApp.initiatorIdentifier = nodeIdentifier;
    freeBalanceApp.userIdentifier = userId;
    freeBalanceApp.nodeIdentifier = nodeId;
    freeBalanceApp.type = AppType.FREE_BALANCE;
    freeBalanceApp.outcomeInterpreterParameters = outcomeInterpreterParameters;

    channel.appInstances = [freeBalanceApp];

    let setupCommitment = await this.setupCommitmentRepository.findByMultisigAddress(
      stateChannel.multisigAddress,
    );
    if (!setupCommitment) {
      setupCommitment = new SetupCommitment();
    }
    setupCommitment.data = signedSetupCommitment.data;
    setupCommitment.to = signedSetupCommitment.to;
    setupCommitment.value = toBN(signedSetupCommitment.value);
    setupCommitment.multisigAddress = stateChannel.multisigAddress;

    channel.setupCommitment = setupCommitment;

    let freeBalanceUpdateCommitment = await this.setStateCommitmentRepository.findByAppIdentityHashAndVersionNumber(
      freeBalanceApp.identityHash,
      toBN(signedFreeBalanceUpdate.versionNumber),
    );

    if (!freeBalanceUpdateCommitment) {
      freeBalanceUpdateCommitment = new SetStateCommitment();
    }
    freeBalanceUpdateCommitment.app = freeBalanceApp;
    freeBalanceUpdateCommitment.appIdentity = signedFreeBalanceUpdate.appIdentity;
    freeBalanceUpdateCommitment.appStateHash = signedFreeBalanceUpdate.appStateHash;
    freeBalanceUpdateCommitment.challengeRegistryAddress =
      signedFreeBalanceUpdate.challengeRegistryAddress;
    freeBalanceUpdateCommitment.signatures = signedFreeBalanceUpdate.signatures;
    freeBalanceUpdateCommitment.stateTimeout = toBN(
      signedFreeBalanceUpdate.stateTimeout,
    ).toString();
    freeBalanceUpdateCommitment.versionNumber = toBN(
      signedFreeBalanceUpdate.versionNumber,
    ).toNumber();

    await getManager().transaction(async (transactionalEntityManager) => {
      await transactionalEntityManager.save(channel);
      await transactionalEntityManager.save(freeBalanceUpdateCommitment);
    });
  }

  async incrementNumProposedApps(multisigAddress: string): Promise<void> {
    const channel = await this.channelRepository.findByMultisigAddressOrThrow(multisigAddress);
    await getManager().transaction(async (transactionalEntityManager) => {
      await transactionalEntityManager
        .createQueryBuilder()
        .update(Channel)
        .set({
          monotonicNumProposedApps: channel.monotonicNumProposedApps + 1,
        })
        .where("multisigAddress = :multisigAddress", { multisigAddress })
        .execute();
    });
  }

  getAppProposal(appIdentityHash: string): Promise<AppInstanceJson> {
    return this.appInstanceRepository.getAppProposal(appIdentityHash);
  }

  async createAppProposal(
    multisigAddress: string,
    appProposal: AppInstanceJson,
    numProposedApps: number,
    signedSetStateCommitment: SetStateCommitmentJSON,
    signedConditionalTxCommitment: ConditionalTransactionCommitmentJSON,
  ): Promise<void> {
    const channel = await this.channelRepository.findByMultisigAddressOrThrow(multisigAddress);

    const app = new AppInstance();
    app.type = AppType.PROPOSAL;
    app.identityHash = appProposal.identityHash;
    app.actionEncoding = appProposal.abiEncodings.actionEncoding;
    app.stateEncoding = appProposal.abiEncodings.stateEncoding;
    app.appDefinition = appProposal.appDefinition;
    app.appSeqNo = appProposal.appSeqNo;
    app.initiatorDeposit = bigNumberify(appProposal.initiatorDeposit);
    app.initiatorDepositAssetId = appProposal.initiatorDepositAssetId;
    app.responderDeposit = bigNumberify(appProposal.responderDeposit);
    app.responderDepositAssetId = appProposal.responderDepositAssetId;
    app.defaultTimeout = appProposal.defaultTimeout;
    app.stateTimeout = appProposal.stateTimeout;
    app.responderIdentifier = appProposal.responderIdentifier;
    app.initiatorIdentifier = appProposal.initiatorIdentifier;
    app.outcomeType = appProposal.outcomeType;
    app.outcomeInterpreterParameters = appProposal.outcomeInterpreterParameters;
    app.meta = appProposal.meta;
    app.latestState = appProposal.latestState;
    app.latestVersionNumber = appProposal.latestVersionNumber;
    app.channel = channel;
    app.userIdentifier = channel.userIdentifier;
    app.nodeIdentifier = channel.nodeIdentifier;

    let setStateCommitment = await this.setStateCommitmentRepository.findByAppIdentityHashAndVersionNumber(
      appProposal.identityHash,
      toBN(signedSetStateCommitment.versionNumber),
    );

    if (!setStateCommitment) {
      setStateCommitment = new SetStateCommitment();
    }
    setStateCommitment.app = app;
    setStateCommitment.appIdentity = signedSetStateCommitment.appIdentity;
    setStateCommitment.appStateHash = signedSetStateCommitment.appStateHash;
    setStateCommitment.challengeRegistryAddress = signedSetStateCommitment.challengeRegistryAddress;
    setStateCommitment.signatures = signedSetStateCommitment.signatures;
    setStateCommitment.stateTimeout = toBN(signedSetStateCommitment.stateTimeout).toString();
    setStateCommitment.versionNumber = toBN(signedSetStateCommitment.versionNumber).toNumber();

    const existingConditionalTx = await this.conditionalTransactionCommitmentRepository.findByAppIdentityHash(
      appProposal.identityHash,
    );

    // because the app instance has `cascade` set to true, saving
    // the channel will involve multiple queries and should be put
    // within a transaction
    await getManager().transaction(async (transactionalEntityManager) => {
      await transactionalEntityManager.save(app);
      await transactionalEntityManager.save(setStateCommitment);

      // idempotence
      if (existingConditionalTx) {
        await transactionalEntityManager
          .createQueryBuilder()
          .update(ConditionalTransactionCommitment)
          .set({
            freeBalanceAppIdentityHash: signedConditionalTxCommitment.freeBalanceAppIdentityHash,
            multisigAddress: signedConditionalTxCommitment.multisigAddress,
            multisigOwners: signedConditionalTxCommitment.multisigOwners,
            interpreterAddr: signedConditionalTxCommitment.interpreterAddr,
            interpreterParams: signedConditionalTxCommitment.interpreterParams,
            signatures: signedConditionalTxCommitment.signatures,
            app,
          })
          .where('"appIdentityHash" = :appIdentityHash', {
            appIdentityHash: signedConditionalTxCommitment.freeBalanceAppIdentityHash,
          })
          .execute();
      } else {
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
            app,
          })
          .execute();
      }

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
        .of(multisigAddress)
        .add(app.identityHash);
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

    app.channel = undefined;
    await getManager().transaction(async (transactionalEntityManager) => {
      await transactionalEntityManager.save(app);
      await transactionalEntityManager
        .createQueryBuilder()
        .relation(Channel, "appInstances")
        .of(multisigAddress)
        .remove(app.identityHash);
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
  ): Promise<void> {
    const {
      identityHash,
      initiatorIdentifier,
      responderIdentifier,
      latestState,
      stateTimeout,
      latestVersionNumber,
    } = appJson;
    const proposal = await this.appInstanceRepository.findByIdentityHashOrThrow(identityHash);

    // upgrade proposal to instance
    proposal.type = AppType.INSTANCE;
    // save user/node specific ids
    const nodeId = this.configService.getPublicIdentifier();
    proposal.userIdentifier = [initiatorIdentifier, responderIdentifier].find((p) => p !== nodeId);
    proposal.nodeIdentifier = [initiatorIdentifier, responderIdentifier].find((p) => p === nodeId);

    proposal.latestState = latestState;
    proposal.stateTimeout = stateTimeout;
    proposal.latestVersionNumber = latestVersionNumber;

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

      await transactionalEntityManager
        .createQueryBuilder()
        .relation(AppInstance, "channel")
        .of(proposal)
        .set(multisigAddress);

      await transactionalEntityManager
        .createQueryBuilder()
        .update(SetStateCommitment)
        .set({
          appIdentity: signedFreeBalanceUpdate.appIdentity,
          appStateHash: signedFreeBalanceUpdate.appStateHash,
          challengeRegistryAddress: signedFreeBalanceUpdate.challengeRegistryAddress,
          signatures: signedFreeBalanceUpdate.signatures,
          stateTimeout: toBN(signedFreeBalanceUpdate.stateTimeout).toString(),
          versionNumber: toBN(signedFreeBalanceUpdate.versionNumber).toNumber(),
        })
        .where('"appIdentityHash" = :appIdentityHash', {
          appIdentityHash: freeBalanceAppInstance.identityHash,
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
          latestState: latestState as AppState,
          stateTimeout,
          latestVersionNumber,
        })
        .where("identityHash = :identityHash", { identityHash })
        .execute();

      await transactionalEntityManager
        .createQueryBuilder()
        .update(SetStateCommitment)
        .set({
          appIdentity: signedSetStateCommitment.appIdentity,
          appStateHash: signedSetStateCommitment.appStateHash,
          challengeRegistryAddress: signedSetStateCommitment.challengeRegistryAddress,
          signatures: signedSetStateCommitment.signatures,
          stateTimeout: toBN(signedSetStateCommitment.stateTimeout).toString(),
          versionNumber: toBN(signedSetStateCommitment.versionNumber).toNumber(),
        })
        .where('"appIdentityHash" = :appIdentityHash', {
          appIdentityHash: signedSetStateCommitment.appIdentityHash,
        })
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
    if (app) {
      app.type = AppType.UNINSTALLED;
      app.channel = null;
    } else {
      this.log.warn(`Could not find app instance to remove`);
    }

    await getManager().transaction(async (transactionalEntityManager) => {
      if (app) {
        await transactionalEntityManager.save(app);
      }
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
        .of(multisigAddress)
        .remove(app.identityHash);

      await transactionalEntityManager
        .createQueryBuilder()
        .update(SetStateCommitment)
        .set({
          appIdentity: signedFreeBalanceUpdate.appIdentity,
          appStateHash: signedFreeBalanceUpdate.appStateHash,
          challengeRegistryAddress: signedFreeBalanceUpdate.challengeRegistryAddress,
          signatures: signedFreeBalanceUpdate.signatures,
          stateTimeout: toBN(signedFreeBalanceUpdate.stateTimeout).toString(),
          versionNumber: toBN(signedFreeBalanceUpdate.versionNumber).toNumber(),
        })
        .where('"appIdentityHash" = :appIdentityHash', {
          appIdentityHash: freeBalanceAppInstance.identityHash,
        })
        .execute();
    });
  }

  getFreeBalance(multisigAddress: string): Promise<AppInstanceJson> {
    return this.appInstanceRepository.getFreeBalance(multisigAddress);
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
    await this.setupCommitmentRepository.createCommitment(multisigAddress, commitment);
  }

  async getSetStateCommitments(appIdentityHash: string): Promise<SetStateCommitmentJSON[]> {
    return (
      await this.setStateCommitmentRepository.findByAppIdentityHash(appIdentityHash)
    ).map((s) => setStateToJson(s));
  }

  async createSetStateCommitment(
    appIdentityHash: string,
    commitment: SetStateCommitmentJSON,
  ): Promise<void> {
    const app = await this.appInstanceRepository.findByIdentityHashOrThrow(appIdentityHash);
    const entity = new SetStateCommitment();
    entity.app = app;
    entity.appIdentity = commitment.appIdentity;
    entity.appStateHash = commitment.appStateHash;
    entity.challengeRegistryAddress = commitment.challengeRegistryAddress;
    entity.signatures = commitment.signatures;
    entity.stateTimeout = toBN(commitment.stateTimeout).toHexString();
    entity.versionNumber = toBN(commitment.versionNumber).toNumber();
    await this.setStateCommitmentRepository.save(entity);
  }

  async updateSetStateCommitment(
    appIdentityHash: string,
    commitment: SetStateCommitmentJSON,
  ): Promise<void> {
    const {
      appStateHash,
      challengeRegistryAddress,
      signatures,
      stateTimeout,
      versionNumber,
    } = commitment;

    const subQuery = this.appInstanceRepository
      .createQueryBuilder("app")
      .select("app.id")
      .where("app.identityHash = :appIdentityHash", { appIdentityHash });

    await this.setStateCommitmentRepository
      .createQueryBuilder("set_state_commitment")
      .update(SetStateCommitment)
      .set({
        appStateHash,
        challengeRegistryAddress,
        signatures,
        stateTimeout: toBN(stateTimeout).toHexString(),
        versionNumber: toBN(versionNumber).toNumber(),
      })
      .where('set_state_commitment."appId" = (' + subQuery.getQuery() + ")")
      .setParameters(subQuery.getParameters())
      .execute();
  }

  async removeSetStateCommitment(
    appIdentityHash: string,
    commitment: SetStateCommitmentJSON,
  ): Promise<void> {
    const versionNumber = toBN(commitment.versionNumber).toNumber();

    const subQuery = this.appInstanceRepository
      .createQueryBuilder("app")
      .select("app.id")
      .where("app.identityHash = :appIdentityHash", { appIdentityHash });

    await this.setStateCommitmentRepository
      .createQueryBuilder("set_state_commitment")
      .delete()
      .from(SetStateCommitment)
      .where("set_state_commitment.versionNumber = :versionNumber", {
        versionNumber,
      })
      .andWhere('set_state_commitment."appId" = (' + subQuery.getQuery() + ")")
      .setParameters(subQuery.getParameters())
      .execute();
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

  clear(): Promise<void> {
    throw new Error("Method not implemented.");
  }

  restore(): Promise<void> {
    throw new Error("Method not implemented.");
  }

  getUserWithdrawals(): Promise<WithdrawalMonitorObject[]> {
    throw new Error("Method not implemented.");
  }

  saveUserWithdrawal(withdrawalObject: WithdrawalMonitorObject): Promise<void> {
    throw new Error("Method not implemented.");
  }

  removeUserWithdrawal(toRemove: WithdrawalMonitorObject): Promise<void> {
    throw new Error("Method not implemented.");
  }

  ////// Watcher methods
  async getAppChallenge(appIdentityHash: string): Promise<StoredAppChallenge | undefined> {
    const challenge = await this.challengeRepository.findByIdentityHash(appIdentityHash);
    return challenge ? entityToStoredChallenge(challenge) : undefined;
  }

  async saveAppChallenge(data: ChallengeUpdatedEventPayload | StoredAppChallenge): Promise<void> {
    const { appStateHash, versionNumber, finalizesAt, status, identityHash } = data;
    const app = await this.appInstanceRepository.findByIdentityHashOrThrow(identityHash);

    const channel = await this.channelRepository.findByAppIdentityHashOrThrow(identityHash);

    let challenge = await this.challengeRepository.findByIdentityHash(identityHash);
    if (!challenge) {
      // create new challenge
      challenge = new Challenge();
      challenge.app = app;
      challenge.channel = channel;
      challenge.challengeUpdatedEvents = [];
      challenge.stateProgressedEvents = [];
    }

    challenge.status = status as StoredAppChallengeStatus;
    challenge.appStateHash = appStateHash;
    challenge.versionNumber = versionNumber;
    challenge.finalizesAt = finalizesAt;

    await getManager().transaction(async (transactionalEntityManager) => {
      await transactionalEntityManager.save(challenge);
    });
  }

  async getActiveChallenges(): Promise<StoredAppChallenge[]> {
    const active = await this.challengeRepository.findActiveChallenges();
    return active.map(entityToStoredChallenge);
  }

  ///// Events
  async getLatestProcessedBlock(): Promise<number> {
    const latest = await this.processedBlockRepository.findLatestProcessedBlock();
    if (!latest) {
      return 0;
    }
    return latest.blockNumber;
  }

  async updateLatestProcessedBlock(blockNumber: number): Promise<void> {
    const entity = new ProcessedBlock();
    entity.blockNumber = blockNumber;
    await this.processedBlockRepository.save(entity);
  }

  async getStateProgressedEvents(appIdentityHash: string): Promise<StateProgressedEventPayload[]> {
    const challenge = await this.challengeRepository.findByIdentityHashOrThrow(appIdentityHash);

    return challenge.stateProgressedEvents.map((event) =>
      entityToStateProgressedEventPayload(event, challenge),
    );
  }

  async addOnchainAction(appIdentityHash: string, provider: JsonRpcProvider): Promise<void> {
    const channel = await this.channelRepository.findByAppIdentityHashOrThrow(appIdentityHash);
    const app = channel.appInstances.find((a) => a.identityHash === appIdentityHash);
    const latestSetState = await this.setStateCommitmentRepository.findByAppIdentityHashAndVersionNumber(
      appIdentityHash,
      toBN(app.latestVersionNumber),
    );
    // fetch onchain data
    const registry = new Contract(
      latestSetState.challengeRegistryAddress,
      ChallengeRegistry.abi,
      provider,
    );
    const onchainChallenge = await registry.functions.getAppChallenge(appIdentityHash);
    if (onchainChallenge.versionNumber.eq(latestSetState.versionNumber)) {
      return;
    }

    // only need state progressed events because challenge should contain
    // all relevant information from challenge updated events
    const fromBlock = (await provider.getBlockNumber()) - 8640; // last 24h
    const rawProgressedLogs = await provider.getLogs({
      // TODO: filter state progressed by appID
      ...registry.filters[ChallengeEvents.StateProgressed](),
      fromBlock: fromBlock < 0 ? 0 : fromBlock,
    });
    const onchainProgressedLogs = rawProgressedLogs
      .map((log) => {
        const {
          identityHash,
          action,
          versionNumber,
          timeout,
          turnTaker,
          signature,
        } = registry.interface.parseLog(log).values;
        return { identityHash, action, versionNumber, timeout, turnTaker, signature };
      })
      .sort((a, b) => b.versionNumber.sub(a.versionNumber).toNumber());
    const {
      action: encodedAction,
      versionNumber,
      timeout,
      turnTaker,
      signature,
    } = onchainProgressedLogs[0];

    // ensure action from event can be applied on top of our app
    if (!versionNumber.eq(app.latestVersionNumber + 1)) {
      throw new Error(
        `Action cannot be applied directly onto our record of app. Record has nonce of ${
          app.latestVersionNumber
        }, and action results in nonce ${versionNumber.toString()}`,
      );
    }

    // generate set state commitment + update app instance
    // we CANNOT generate any signatures here, and instead will save the
    // app as a single signed update. (i.e. as in the take-action protocol
    // for the initiator). This means there will NOT be an app instance
    // saved at the same nonce as the most recent single signed set-state
    // commitment
    const appSigners = [app.initiatorIdentifier, app.responderIdentifier].map(
      getSignerAddressFromPublicIdentifier,
    );
    const turnTakerIdx = appSigners.findIndex((signer) => signer === turnTaker);
    const signatures = turnTakerIdx === 0 ? [signature, undefined] : [undefined, signature];

    const exists = !!(await this.setStateCommitmentRepository.findByAppIdentityHashAndVersionNumber(
      appIdentityHash,
      onchainChallenge.versionNumber,
    ));
    await getManager().transaction(async (transactionalEntityManager) => {
      // update challenge
      await transactionalEntityManager
        .createQueryBuilder()
        .update(Challenge)
        .set({
          ...onchainChallenge,
        })
        .where("challenge.identityHash = :appIdentityHash", {
          appIdentityHash,
        })
        .execute();

      // update app
      await transactionalEntityManager
        .createQueryBuilder()
        .update(AppInstance)
        .set({
          latestAction: defaultAbiCoder.decode([app.actionEncoding], encodedAction),
        })
        .where("app.identityHash = :appIdentityHash", {
          appIdentityHash,
        })
        .execute();

      // update or create set state
      if (exists) {
        await transactionalEntityManager
          .createQueryBuilder()
          .update(SetStateCommitment)
          .set({
            signatures,
            stateTimeout: timeout.toString(),
            appStateHash: onchainChallenge.appStateHash,
          })
          .where("app.identityHash = :appIdentityHash", {
            appIdentityHash,
          })
          .andWhere("app.versionNumber = :versionNumner", {
            versionNumber: versionNumber.toNumber(),
          })
          .execute();
      } else {
        // create new
        await transactionalEntityManager
          .createQueryBuilder()
          .insert()
          .into(SetStateCommitment)
          .values({
            app,
            signatures,
            appIdentity: {
              channelNonce: toBN(app.appSeqNo),
              participants: appSigners,
              multisigAddress: channel.multisigAddress,
              appDefinition: app.appDefinition,
              defaultTimeout: toBN(app.defaultTimeout),
            },
            appStateHash: onchainChallenge.appStateHash,
            versionNumber: onchainChallenge.versionNumber,
            stateTimeout: timeout.toString(),
            challengeRegistryAddress: latestSetState.challengeRegistryAddress,
          })
          .execute();
      }
    });
  }

  async createStateProgressedEvent(event: StateProgressedEventPayload): Promise<void> {
    const { signature, action, timeout, turnTaker, versionNumber, identityHash } = event;
    // safe to throw here because challenges should never be created from a
    // `StateProgressed` event, must always go through the set state game
    const challenge = await this.challengeRepository.findByIdentityHashOrThrow(identityHash);
    if (!challenge.app.actionEncoding) {
      throw new Error(
        `App associated with state progressed event does not have action encoding. Event: ${stringify(
          event,
        )}`,
      );
    }
    const entity = new StateProgressedEvent();
    entity.action = defaultAbiCoder.decode([challenge.app.actionEncoding], action)[0];
    entity.challenge = challenge;
    entity.signature = signature;
    entity.timeout = timeout;
    entity.versionNumber = versionNumber;
    entity.turnTaker = turnTaker;

    await getManager().transaction(async (transactionalEntityManager) => {
      await transactionalEntityManager.save(entity);

      // all contracts emit a `ChallengeUpdated` event, so update any
      // challenge fields using data from that event, not this one

      await transactionalEntityManager
        .createQueryBuilder()
        .relation(Challenge, "stateProgressedEvents")
        .of(challenge.id)
        .add(entity.id);
    });
  }

  async createChallengeUpdatedEvent(event: ChallengeUpdatedEventPayload): Promise<void> {
    const { versionNumber, identityHash, status, appStateHash, finalizesAt } = event;
    const challenge = await this.challengeRepository.findByIdentityHashOrThrow(identityHash);
    await getManager().transaction(async (transactionalEntityManager) => {
      // insert event
      await transactionalEntityManager
        .createQueryBuilder()
        .insert()
        .into(ChallengeUpdatedEvent)
        .values({
          status: status as ChallengeStatus,
          appStateHash,
          versionNumber,
          finalizesAt,
          challenge,
        })
        .execute();
    });
  }

  async getChallengeUpdatedEvents(
    appIdentityHash: string,
  ): Promise<ChallengeUpdatedEventPayload[]> {
    const challenge = await this.challengeRepository.findByIdentityHashOrThrow(appIdentityHash);

    return challenge.challengeUpdatedEvents.map((event) =>
      entityToChallengeUpdatedPayload(event, challenge),
    );
  }
}
