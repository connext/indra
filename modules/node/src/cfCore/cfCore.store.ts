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
import { Zero, AddressZero } from "ethers/constants";
import { getManager } from "typeorm";
import { bigNumberify } from "ethers/utils";

import { AppInstanceRepository } from "../appInstance/appInstance.repository";
import {
  SetStateCommitmentRepository,
  setStateToJson,
} from "../setStateCommitment/setStateCommitment.repository";
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
import { WithdrawCommitment } from "../withdrawCommitment/withdrawCommitment.entity";

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
    // called when setup commitment is created in protocol
    // managed node-side via migrations
    return Promise.resolve();
  }

  async getAllChannels(): Promise<StateChannelJSON[]> {
    const allChannels = await this.channelRepository.find();
    return allChannels.map(channel => convertChannelToJSON(channel));
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

  async createStateChannel(stateChannel: StateChannelJSON): Promise<void> {
    const setup = await this.setupCommitmentRepository.findByMultisigAddressOrThrow(
      stateChannel.multisigAddress,
    );

    const nodeIdentifier = this.configService.getPublicIdentifier();
    const userIdentifier = stateChannel.userIdentifiers.find(id => id !== nodeIdentifier);

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
    channel.setupCommitment = setup;
    const swaps = this.configService.getAllowedSwaps();
    let activeCollateralizations = {};
    swaps.forEach(swap => {
      activeCollateralizations[swap.to] = false;
    });
    channel.activeCollateralizations = activeCollateralizations;

    const participants = [
      freeBalanceAppInstance.initiatorIdentifier,
      freeBalanceAppInstance.responderIdentifier,
    ];
    const userId = participants.find(p => p === userIdentifier);
    const nodeId = participants.find(p => p === nodeIdentifier);
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
    freeBalanceApp.initiatorDeposit = Zero;
    freeBalanceApp.initiatorDepositAssetId = AddressZero;
    freeBalanceApp.responderDeposit = Zero;
    freeBalanceApp.responderDepositAssetId = AddressZero;
    freeBalanceApp.responderIdentifier = userIdentifier;
    freeBalanceApp.initiatorIdentifier = nodeIdentifier;
    freeBalanceApp.userIdentifier = userId;
    freeBalanceApp.nodeIdentifier = nodeId;
    freeBalanceApp.type = AppType.FREE_BALANCE;

    channel.appInstances = [freeBalanceApp];
    await this.channelRepository.save(channel);
  }

  getAppInstance(appIdentityHash: string): Promise<AppInstanceJson> {
    return this.appInstanceRepository.getAppInstance(appIdentityHash);
  }

  async createAppInstance(
    multisigAddress: string,
    appJson: AppInstanceJson,
    freeBalanceAppInstance: AppInstanceJson,
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
    proposal.userIdentifier = [initiatorIdentifier, responderIdentifier].find(p => p !== nodeId);
    proposal.nodeIdentifier = [initiatorIdentifier, responderIdentifier].find(p => p === nodeId);

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

    await getManager().transaction(async transactionalEntityManager => {
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
    });
  }

  async updateAppInstance(multisigAddress: string, appJson: AppInstanceJson): Promise<void> {
    const { identityHash, latestState, stateTimeout, latestVersionNumber } = appJson;
    const app = await this.appInstanceRepository.findByIdentityHash(identityHash);

    if (!app) {
      throw new Error(`No app found when trying to update. AppId: ${identityHash}`);
    }

    if (app.type !== AppType.INSTANCE && app.type !== AppType.FREE_BALANCE) {
      throw new Error(`App is not of correct type, type: ${app.type}`);
    }

    await getManager().transaction(async transactionalEntityManager => {
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
    });
  }

  async removeAppInstance(
    multisigAddress: string,
    appIdentityHash: string,
    freeBalanceAppInstance: AppInstanceJson,
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

    await getManager().transaction(async transactionalEntityManager => {
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
    });
  }

  getAppProposal(appIdentityHash: string): Promise<AppInstanceProposal> {
    return this.appInstanceRepository.getAppProposal(appIdentityHash);
  }

  async createAppProposal(
    multisigAddress: string,
    appProposal: AppInstanceProposal,
    numProposedApps: number,
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
    app.meta = appProposal.meta;
    app.initialState = appProposal.initialState;
    app.latestState = appProposal.initialState;
    app.latestVersionNumber = 0;
    app.channel = channel;

    // because the app instance has `cascade` set to true, saving
    // the channel will involve multiple queries and should be put
    // within a transaction
    await getManager().transaction(async transactionalEntityManager => {
      await transactionalEntityManager.save(app);

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
    await getManager().transaction(async transactionalEntityManager => {
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
    await this.updateAppInstance(multisigAddress, freeBalanceAppInstance);
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
    return (await this.setStateCommitmentRepository.findByAppIdentityHash(appIdentityHash)).map(s =>
      setStateToJson(s),
    );
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
    entity.stateTimeout = commitment.stateTimeout;
    entity.versionNumber = commitment.versionNumber;
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
        stateTimeout,
        versionNumber,
      })
      .where('set_state_commitment."appId" = (' + subQuery.getQuery() + ")")
      .setParameters(subQuery.getParameters())
      .execute();
  }

  async removeSetStateCommitment(
    appIdentityHash: string,
    commitment: SetStateCommitmentJSON,
  ): Promise<void> {
    const { versionNumber } = commitment;

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

  async createConditionalTransactionCommitment(
    appIdentityHash: string,
    commitment: ConditionalTransactionCommitmentJSON,
  ): Promise<void> {
    const app = await this.appInstanceRepository.findByIdentityHashOrThrow(appIdentityHash);

    const existing = await this.conditionalTransactionCommitmentRepository.findByAppIdentityHash(
      appIdentityHash,
    );

    if (existing) {
      throw new Error(`Found existing conditional transaction commitment for ${appIdentityHash}`);
    }

    await this.conditionalTransactionCommitmentRepository
      .createQueryBuilder()
      .insert()
      .into(ConditionalTransactionCommitment)
      .values({
        freeBalanceAppIdentityHash: commitment.freeBalanceAppIdentityHash,
        multisigAddress: commitment.multisigAddress,
        multisigOwners: commitment.multisigOwners,
        interpreterAddr: commitment.interpreterAddr,
        interpreterParams: commitment.interpreterParams,
        signatures: commitment.signatures,
        app,
      })
      .execute();
  }

  async updateConditionalTransactionCommitment(
    appIdentityHash: string,
    commitment: ConditionalTransactionCommitmentJSON,
  ): Promise<void> {
    const { interpreterParams, signatures } = commitment;

    const subQuery = this.appInstanceRepository
      .createQueryBuilder("app")
      .select("app.id")
      .where("app.identityHash = :appIdentityHash", { appIdentityHash });

    await this.conditionalTransactionCommitmentRepository
      .createQueryBuilder("conditional_transaction_commitment")
      .update(ConditionalTransactionCommitment)
      .set({
        interpreterParams,
        signatures,
      })
      .where('conditional_transaction_commitment."appId" = (' + subQuery.getQuery() + ")")
      .setParameters(subQuery.getParameters())
      .execute();
  }

  getWithdrawalCommitment(multisigAddress: string): Promise<MinimalTransaction> {
    return this.withdrawCommitmentRepository.getWithdrawalCommitmentTx(multisigAddress);
  }

  async createWithdrawalCommitment(
    multisigAddress: string,
    commitment: MinimalTransaction,
  ): Promise<void> {
    const channel = await this.channelRepository.findByMultisigAddressOrThrow(multisigAddress);
    const commitmentEnt = new WithdrawCommitment();
    commitmentEnt.channel = channel;
    commitmentEnt.to = commitment.to;
    commitmentEnt.value = bigNumberify(commitment.value);
    commitmentEnt.data = commitment.data;
    await this.withdrawCommitmentRepository.save(commitmentEnt);
  }

  async updateWithdrawalCommitment(
    multisigAddress: string,
    commitment: MinimalTransaction,
  ): Promise<void> {
    const { to, value, data } = commitment;
    const subQuery = this.channelRepository
      .createQueryBuilder("channel")
      .select("channel.id")
      .where("channel.multisigAddress = :multisigAddress", { multisigAddress });

    await this.withdrawCommitmentRepository
      .createQueryBuilder("withdraw_commitment")
      .update(WithdrawCommitment)
      .set({
        to,
        value: bigNumberify(value),
        data,
      })
      .where('withdraw_commitment."channelId" = (' + subQuery.getQuery() + ")")
      .setParameters(subQuery.getParameters())
      .execute();
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

  async createAppChallenge(appIdentityHash: string, appChallenge: AppChallenge): Promise<void> {
    throw new Error("Disputes not implememented");
  }

  async updateAppChallenge(appIdentityHash: string, appChallenge: AppChallenge): Promise<void> {
    throw new Error("Disputes not implememented");
  }

  async getActiveChallenges(multisigAddress: string): Promise<AppChallenge[]> {
    throw new Error("Disputes not implememented");
  }

  ///// Events
  async getLatestProcessedBlock(): Promise<number> {
    throw new Error("Disputes not implememented");
  }

  async updateLatestProcessedBlock(blockNumber: number): Promise<void> {
    throw new Error("Disputes not implememented");
  }

  async getStateProgressedEvents(
    appIdentityHash: string,
  ): Promise<StateProgressedContractEvent[]> {
    throw new Error("Disputes not implememented");
  }

  async createStateProgressedEvent(
    appIdentityHash: string,
    appChallenge: StateProgressedContractEvent,
  ): Promise<void> {
    throw new Error("Disputes not implememented");
  }

  async updateStateProgressedEvent(
    appIdentityHash: string,
    appChallenge: StateProgressedContractEvent,
  ): Promise<void> {
    throw new Error("Disputes not implememented");
  }

  async getChallengeUpdatedEvents(
    appIdentityHash: string,
  ): Promise<ChallengeUpdatedContractEvent[]> {
    throw new Error("Disputes not implememented");
  }

  async createChallengeUpdatedEvent(
    appIdentityHash: string,
    event: ChallengeUpdatedContractEvent,
  ): Promise<void> {
    throw new Error("Disputes not implememented");
  }

  async updateChallengeUpdatedEvent(
    appIdentityHash: string,
    appChallenge: ChallengeUpdatedContractEvent,
  ): Promise<void> {
    throw new Error("Disputes not implememented");
  }
}
