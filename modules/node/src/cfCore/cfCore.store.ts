import { Injectable } from "@nestjs/common";
import {
  AppInstanceJson,
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
  StateSchemaVersion,
  STORE_SCHEMA_VERSION,
  StoredAppChallenge,
  StoredAppChallengeStatus,
  WithdrawalMonitorObject,
} from "@connext/types";
import { getSignerAddressFromPublicIdentifier, stringify, toBN } from "@connext/utils";
import { getManager } from "typeorm";
import { BigNumber, constants, utils } from "ethers";

import {
  AppInstanceRepository,
  AppInstanceSerializer,
} from "../appInstance/appInstance.repository";
import {
  SetStateCommitmentRepository,
  setStateToJson,
} from "../setStateCommitment/setStateCommitment.repository";
import { ConfigService } from "../config/config.service";
import {
  ConditionalTransactionCommitmentRepository,
  convertConditionalCommitmentToJson,
} from "../conditionalCommitment/conditionalCommitment.repository";
import { ChannelRepository, ChannelSerializer } from "../channel/channel.repository";
import { SetupCommitmentRepository } from "../setupCommitment/setupCommitment.repository";
import { AppInstance, AppType } from "../appInstance/appInstance.entity";
import { SetStateCommitment } from "../setStateCommitment/setStateCommitment.entity";
import { Channel } from "../channel/channel.entity";
import {
  ChallengeRepository,
  entityToStoredChallenge,
  ProcessedBlockRepository,
} from "../challenge/challenge.repository";
import { Challenge, ProcessedBlock } from "../challenge/challenge.entity";
import {
  entityToStateProgressedEventPayload,
  StateProgressedEvent,
} from "../stateProgressedEvent/stateProgressedEvent.entity";
import {
  ChallengeUpdatedEvent,
  entityToChallengeUpdatedPayload,
} from "../challengeUpdatedEvent/challengeUpdatedEvent.entity";
import { SetupCommitment } from "../setupCommitment/setupCommitment.entity";
import { ChallengeRegistry } from "@connext/contracts";
import { LoggerService } from "../logger/logger.service";
import { CacheService } from "../caching/cache.service";
import { ConditionalTransactionCommitment } from "../conditionalCommitment/conditionalCommitment.entity";
import { Transfer } from "../transfer/transfer.entity";

const { Zero, AddressZero } = constants;
const { defaultAbiCoder } = utils;

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
    private readonly cache: CacheService,
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
    return allChannels.map((channel) => ChannelSerializer.toJSON(channel)!);
  }

  async getStateChannel(multisigAddress: string): Promise<StateChannelJSON | undefined> {
    const cacheRes = this.cache.wrap<StateChannelJSON, Channel>(
      `channel:multisig:${multisigAddress}`,
      60,
      async () => {
        const res = (await this.channelRepository.findByMultisigAddress(multisigAddress))!;
        return res;
      },
      ChannelSerializer,
    );
    return cacheRes;
  }

  async getStateChannelByOwnersAndChainId(
    owners: string[],
    chainId: number,
  ): Promise<StateChannelJSON | undefined> {
    const multisig = await this.cache.get(
      `channel:owners:${this.canonicalizeOwners(owners)}:${chainId}`,
    );
    if (multisig) {
      return this.getStateChannel(JSON.parse(multisig));
    }

    const chan = await this.channelRepository.findByOwners([owners[0], owners[1]]);
    if (!chan) {
      return undefined;
    }
    await this.cache.set(
      `channel:owners:${this.canonicalizeOwners([
        chan.nodeIdentifier,
        chan.userIdentifier,
      ])}:${chainId}`,
      70,
      chan.multisigAddress,
    );
    await this.cache.set(
      `channel:multisig:${chan.multisigAddress}`,
      60,
      ChannelSerializer.toJSON(chan),
    );
    return ChannelSerializer.toJSON(chan);
  }

  async getStateChannelByAppIdentityHash(
    appIdentityHash: string,
  ): Promise<StateChannelJSON | undefined> {
    const multisig = await this.cache.get(`channel:appIdentityHash:${appIdentityHash}`);
    if (multisig) {
      return this.getStateChannel(JSON.parse(multisig));
    }

    const chan = await this.channelRepository.findByAppIdentityHash(appIdentityHash);
    if (!chan) {
      return undefined;
    }
    await this.cache.set(
      `channel:owners:${this.canonicalizeOwners([chan.nodeIdentifier, chan.userIdentifier])}`,
      70,
      chan.multisigAddress,
    );
    await this.cache.set(`channel:appIdentityHash:${appIdentityHash}`, 70, chan.multisigAddress);
    await this.cache.set(
      `channel:multisig:${chan.multisigAddress}`,
      60,
      ChannelSerializer.toJSON(chan),
    );
    return ChannelSerializer.toJSON(chan);
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
      chainId,
    } = stateChannel;

    let channel = new Channel();
    channel.multisigAddress = multisigAddress;
    channel.schemaVersion = StateSchemaVersion;
    channel.userIdentifier = userIdentifier!;
    channel.nodeIdentifier = nodeIdentifier;
    channel.addresses = addresses;
    channel.monotonicNumProposedApps = monotonicNumProposedApps;
    channel.chainId = chainId;
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
      initiatorIdentifier,
      responderIdentifier,
    } = freeBalanceAppInstance!;

    const freeBalanceApp = new AppInstance();
    freeBalanceApp.identityHash = identityHash;
    freeBalanceApp.appDefinition = appDefinition;
    freeBalanceApp.stateEncoding = stateEncoding;
    freeBalanceApp.actionEncoding = actionEncoding!;
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
    freeBalanceApp.responderIdentifier = responderIdentifier;
    freeBalanceApp.initiatorIdentifier = initiatorIdentifier;
    freeBalanceApp.type = AppType.FREE_BALANCE;
    freeBalanceApp.outcomeInterpreterParameters = outcomeInterpreterParameters;
    freeBalanceApp.channel = channel;

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

    // eslint-disable-next-line max-len
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
    freeBalanceUpdateCommitment.transactionData = signedFreeBalanceUpdate.transactionData;

    await getManager().transaction(async (transactionalEntityManager) => {
      channel = await transactionalEntityManager.save(channel);
      await transactionalEntityManager.save(freeBalanceApp);
      await transactionalEntityManager.save(freeBalanceUpdateCommitment);
    });
    await this.cache.set(
      `channel:multisig:${multisigAddress}`,
      60,
      ChannelSerializer.toJSON(channel),
    );
    await this.cache.set(
      `channel:owners:${this.canonicalizeOwners([channel.nodeIdentifier, channel.userIdentifier])}`,
      70,
      channel.multisigAddress,
    );
    await this.cache.set(
      `appInstance:identityHash:${freeBalanceApp.identityHash}`,
      60,
      AppInstanceSerializer.toJSON(freeBalanceApp),
    );
  }

  async updateNumProposedApps(
    multisigAddress: string,
    numProposedApps: number,
    stateChannel: StateChannelJSON,
  ): Promise<void> {
    await getManager().transaction(async (transactionalEntityManager) => {
      await transactionalEntityManager
        .createQueryBuilder()
        .update(Channel)
        .set({
          monotonicNumProposedApps: numProposedApps,
        })
        .where("multisigAddress = :multisigAddress", { multisigAddress })
        .execute();
    });
    await this.cache.mergeCacheValues<StateChannelJSON>(`channel:multisig:${multisigAddress}`, 60, {
      monotonicNumProposedApps: numProposedApps,
    });
  }

  async getAppProposal(appIdentityHash: string): Promise<AppInstanceJson | undefined> {
    return this.cache.wrap<AppInstanceJson, AppInstance | undefined>(
      `appInstance:identityHash:${appIdentityHash}`,
      60,
      () => this.appInstanceRepository.findByIdentityHashAndType(appIdentityHash, AppType.PROPOSAL),
      AppInstanceSerializer,
    );
  }

  async createAppProposal(
    multisigAddress: string,
    appProposal: AppInstanceJson,
    numProposedApps: number,
    signedSetStateCommitment: SetStateCommitmentJSON,
    signedConditionalTxCommitment: ConditionalTransactionCommitmentJSON,
    stateChannelJson?: StateChannelJSON,
  ): Promise<void> {
    await getManager().query("SELECT create_app_proposal($1, $2, $3, $4)", [
      appProposal,
      numProposedApps,
      {
        ...signedSetStateCommitment,
        versionNumber: BigNumber.from(signedSetStateCommitment.versionNumber).toNumber(),
        stateTimeout: BigNumber.from(signedSetStateCommitment.stateTimeout).toHexString(),
      },
      signedConditionalTxCommitment,
    ]);

    // Update cache values

    await this.cache.set<AppInstanceJson>(
      `appInstance:identityHash:${appProposal.identityHash}`,
      60,
      appProposal,
    );

    await this.cache.set<StateChannelJSON>(
      `channel:multisig:${multisigAddress}`,
      60,
      stateChannelJson!,
    );

    await this.cache.set(
      `channel:appIdentityHash:${appProposal.identityHash}`,
      70,
      multisigAddress,
    );
  }

  async removeAppProposal(
    multisigAddress: string,
    appIdentityHash: string,
    stateChannelJson?: StateChannelJSON,
  ): Promise<void> {
    await getManager().transaction(async (transactionalEntityManager) => {
      await transactionalEntityManager
        .createQueryBuilder()
        .delete()
        .from(SetStateCommitment)
        .where(`"appIdentityHash" = :appIdentityHash`, { appIdentityHash })
        .execute();

      await transactionalEntityManager
        .createQueryBuilder()
        .delete()
        .from(ConditionalTransactionCommitment)
        .where(`"appIdentityHash" = :appIdentityHash`, { appIdentityHash })
        .execute();

      await transactionalEntityManager
        .createQueryBuilder()
        .delete()
        .from(AppInstance)
        .where(`"identityHash" = :appIdentityHash`, { appIdentityHash })
        .execute();

      await this.cache.del(`appInstance:identityHash:${appIdentityHash}`);
      await this.cache.set<StateChannelJSON>(
        `channel:multisig:${multisigAddress}`,
        60,
        stateChannelJson!,
      );
    });
  }

  async getAppInstance(appIdentityHash: string): Promise<AppInstanceJson | undefined> {
    return this.cache.wrap<AppInstanceJson, AppInstance | undefined>(
      `appInstance:identityHash:${appIdentityHash}`,
      60,
      () => this.appInstanceRepository.findByIdentityHashAndType(appIdentityHash, AppType.INSTANCE),
      AppInstanceSerializer,
    );
  }

  async createAppInstance(
    multisigAddress: string,
    appJson: AppInstanceJson,
    freeBalanceAppInstance: AppInstanceJson,
    signedFreeBalanceUpdate: SetStateCommitmentJSON,
    stateChannelJson?: StateChannelJSON,
  ): Promise<void> {
    const { identityHash } = appJson;

    await getManager().query("SELECT create_app_instance($1, $2, $3)", [
      appJson,
      freeBalanceAppInstance,
      {
        ...signedFreeBalanceUpdate,
        versionNumber: BigNumber.from(signedFreeBalanceUpdate.versionNumber).toNumber(),
        stateTimeout: BigNumber.from(signedFreeBalanceUpdate.stateTimeout).toHexString(),
      },
    ]);

    await this.cache.set<AppInstanceJson>(
      `appInstance:identityHash:${freeBalanceAppInstance.identityHash}`,
      60,
      freeBalanceAppInstance,
    );
    await this.cache.set<AppInstanceJson>(`appInstance:identityHash:${identityHash}`, 60, appJson);
    await this.cache.set(`channel:appIdentityHash:${identityHash}`, 70, multisigAddress);
    await this.cache.set<StateChannelJSON>(
      `channel:multisig:${multisigAddress}`,
      60,
      stateChannelJson!,
    );
  }

  async updateAppInstance(
    multisigAddress: string,
    appJson: AppInstanceJson,
    signedSetStateCommitment: SetStateCommitmentJSON,
    stateChannelJson?: StateChannelJSON,
  ): Promise<void> {
    const { identityHash } = appJson;

    await getManager().query("SELECT update_app_instance($1, $2)", [
      appJson,
      {
        ...signedSetStateCommitment,
        versionNumber: BigNumber.from(signedSetStateCommitment.versionNumber).toNumber(),
        stateTimeout: BigNumber.from(signedSetStateCommitment.stateTimeout).toHexString(),
      },
    ]);

    await this.cache.set<AppInstanceJson>(`appInstance:identityHash:${identityHash}`, 60, appJson);
    await this.cache.set(`channel:appIdentityHash:${identityHash}`, 70, multisigAddress);
    await this.cache.set<StateChannelJSON>(
      `channel:multisig:${multisigAddress}`,
      60,
      stateChannelJson!,
    );
  }

  async removeAppInstance(
    multisigAddress: string,
    appInstance: AppInstanceJson,
    freeBalanceAppInstance: AppInstanceJson,
    signedFreeBalanceUpdate: SetStateCommitmentJSON,
    stateChannelJson?: StateChannelJSON,
  ): Promise<void> {
    await getManager().query("SELECT remove_app_instance($1, $2, $3)", [
      appInstance,
      freeBalanceAppInstance,
      {
        ...signedFreeBalanceUpdate,
        versionNumber: BigNumber.from(signedFreeBalanceUpdate.versionNumber).toNumber(),
        stateTimeout: BigNumber.from(signedFreeBalanceUpdate.stateTimeout).toHexString(),
      },
    ]);

    await this.cache.set<AppInstanceJson>(
      `appInstance:identityHash:${freeBalanceAppInstance.identityHash}`,
      60,
      freeBalanceAppInstance,
    );
    await this.cache.del(`appInstance:identityHash:${appInstance.identityHash}`);
    await this.cache.del(`channel:appIdentityHash:${appInstance.identityHash}`);
    await this.cache.set<StateChannelJSON>(
      `channel:multisig:${multisigAddress}`,
      60,
      stateChannelJson!,
    );
  }

  getFreeBalance(multisigAddress: string): Promise<AppInstanceJson | undefined> {
    return this.appInstanceRepository.getFreeBalance(multisigAddress);
  }

  getSetupCommitment(multisigAddress: string): Promise<MinimalTransaction | undefined> {
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
    return commitment && convertConditionalCommitmentToJson(commitment);
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

    return challenge.stateProgressedEvents.map(
      (event) => entityToStateProgressedEventPayload(event, challenge)!,
    );
  }

  async addOnchainAction(appIdentityHash: string, provider: JsonRpcProvider): Promise<void> {
    const channel = await this.channelRepository.findByAppIdentityHashOrThrow(appIdentityHash);
    const app = channel.appInstances.find((a) => a.identityHash === appIdentityHash);
    // eslint-disable-next-line max-len
    const latestSetState = await this.setStateCommitmentRepository.findByAppIdentityHashAndVersionNumber(
      appIdentityHash,
      toBN(app!.latestVersionNumber),
    );
    // fetch onchain data
    const registry = new Contract(
      latestSetState!.challengeRegistryAddress,
      ChallengeRegistry.abi,
      provider,
    );
    const onchainChallenge = await registry.getAppChallenge(appIdentityHash);
    if (onchainChallenge.versionNumber.eq(latestSetState!.versionNumber)) {
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
        } = registry.interface.parseLog(log).args;
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
    if (!versionNumber.eq(app!.latestVersionNumber + 1)) {
      throw new Error(
        `Action cannot be applied directly onto our record of app. Record has nonce of ${
          app!.latestVersionNumber
        }, and action results in nonce ${versionNumber.toString()}`,
      );
    }

    // generate set state commitment + update app instance
    // we CANNOT generate any signatures here, and instead will save the
    // app as a single signed update. (i.e. as in the take-action protocol
    // for the initiator). This means there will NOT be an app instance
    // saved at the same nonce as the most recent single signed set-state
    // commitment
    const appSigners = [app!.initiatorIdentifier, app!.responderIdentifier].map(
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
          latestAction: defaultAbiCoder.decode([app!.actionEncoding], encodedAction),
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
              channelNonce: toBN(app!.appSeqNo),
              participants: appSigners,
              multisigAddress: channel.multisigAddress,
              appDefinition: app!.appDefinition,
              defaultTimeout: toBN(app!.defaultTimeout),
            },
            appStateHash: onchainChallenge.appStateHash,
            versionNumber: onchainChallenge.versionNumber,
            stateTimeout: timeout.toString(),
            challengeRegistryAddress: latestSetState!.challengeRegistryAddress,
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

    return challenge.challengeUpdatedEvents.map(
      (event) => entityToChallengeUpdatedPayload(event, challenge)!,
    );
  }

  private canonicalizeOwners(owners: string[]) {
    if (owners.length !== 2) {
      throw new Error("sanity error - must have 2 owners");
    }

    return owners.sort().join(":");
  }
}
