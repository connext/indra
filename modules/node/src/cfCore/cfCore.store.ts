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
import { getManager } from "typeorm";
import { bigNumberify } from "ethers/utils";

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

    const {
      multisigAddress,
      addresses,
      freeBalanceAppInstance,
      monotonicNumProposedApps,
    } = stateChannel;
    const channel = new Channel();
    channel.schemaVersion = this.schemaVersion;
    channel.userPublicIdentifier = userPublicIdentifier;
    channel.nodePublicIdentifier = nodePublicIdentifier;
    channel.multisigAddress = multisigAddress;
    channel.addresses = addresses;
    channel.monotonicNumProposedApps = monotonicNumProposedApps;
    channel.setupCommitment = setup;

    const userFreeBalance = xkeyKthAddress(userPublicIdentifier);
    const nodeFreeBalance = xkeyKthAddress(this.configService.getPublicIdentifier());
    const userParticipantAddress = freeBalanceAppInstance.participants.find(
      p => p === userFreeBalance,
    );
    const nodeParticipantAddress = freeBalanceAppInstance.participants.find(
      p => p === nodeFreeBalance,
    );
    const {
      identityHash,
      appInterface: { stateEncoding, actionEncoding, addr },
      outcomeType,
      latestState,
      latestTimeout,
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
    freeBalanceApp.timeout = defaultTimeout;
    freeBalanceApp.latestTimeout = latestTimeout;

    // app proposal defaults
    freeBalanceApp.initiatorDeposit = Zero;
    freeBalanceApp.initiatorDepositTokenAddress = AddressZero;
    freeBalanceApp.responderDeposit = Zero;
    freeBalanceApp.responderDepositTokenAddress = AddressZero;
    freeBalanceApp.proposedToIdentifier = userPublicIdentifier;
    freeBalanceApp.proposedByIdentifier = nodePublicIdentifier;
    freeBalanceApp.userParticipantAddress = userParticipantAddress;
    freeBalanceApp.nodeParticipantAddress = nodeParticipantAddress;
    freeBalanceApp.type = AppType.FREE_BALANCE;

    channel.appInstances = [freeBalanceApp];
    await this.channelRepository.save(channel);
  }

  getAppInstance(appInstanceId: string): Promise<AppInstanceJson> {
    return this.appInstanceRepository.getAppInstance(appInstanceId);
  }

  async createAppInstance(
    multisigAddress: string,
    appJson: AppInstanceJson,
    freeBalanceAppInstance: AppInstanceJson,
  ): Promise<void> {
    const {
      identityHash,
      participants,
      latestState,
      latestTimeout,
      latestVersionNumber,
      meta,
    } = appJson;
    const proposal = await this.appInstanceRepository.findByIdentityHashOrThrow(identityHash);
    if (proposal.type !== AppType.PROPOSAL) {
      throw new Error(`Application already exists: ${appJson.identityHash}`);
    }

    // upgrade proposal to instance
    proposal.type = AppType.INSTANCE;
    // save participants
    let userAddr = xkeyKthAddress(this.configService.getPublicIdentifier(), proposal.appSeqNo);
    if (!participants.find(p => p === userAddr)) {
      userAddr = xkeyKthAddress(this.configService.getPublicIdentifier());
    }
    proposal.userParticipantAddress = participants.find(p => p === userAddr);
    proposal.nodeParticipantAddress = participants.find(p => p !== userAddr);

    proposal.meta = meta;

    proposal.initialState = latestState;
    proposal.latestState = latestState;
    proposal.latestTimeout = latestTimeout;
    proposal.latestVersionNumber = latestVersionNumber;

    // update free balance app
    const freeBalanceAppEntity = await this.appInstanceRepository.findByIdentityHashOrThrow(
      freeBalanceAppInstance.identityHash,
    );
    freeBalanceAppEntity.latestState = freeBalanceAppInstance.latestState;
    freeBalanceAppEntity.latestTimeout = freeBalanceAppInstance.latestTimeout;
    freeBalanceAppEntity.latestVersionNumber = freeBalanceAppInstance.latestVersionNumber;

    await getManager().transaction(async transactionalEntityManager => {
      await transactionalEntityManager.save(proposal);
      await transactionalEntityManager.save(freeBalanceAppEntity);
    });
  }

  async updateAppInstance(multisigAddress: string, appJson: AppInstanceJson): Promise<void> {
    const { identityHash, latestState, latestTimeout, latestVersionNumber } = appJson;

    await this.appInstanceRepository
      .createQueryBuilder()
      .update(AppInstance)
      .set({
        latestState: latestState as any,
        latestTimeout,
        latestVersionNumber,
      })
      .where("identityHash = :identityHash", { identityHash })
      .execute();
  }

  async removeAppInstance(
    multisigAddress: string,
    appInstanceId: string,
    freeBalanceAppInstance: AppInstanceJson,
  ): Promise<void> {
    const app = await this.appInstanceRepository.findByIdentityHash(appInstanceId);
    if (!app) {
      throw new Error(`No app found when trying to remove. AppId: ${appInstanceId}`);
    }
    if (app.type !== AppType.INSTANCE) {
      throw new Error(`App is not of correct type`);
    }
    app.type = AppType.UNINSTALLED;

    const channelId = app.channel.id;
    app.channel = null;

    // update free balance
    const freeBalanceAppEntity = await this.appInstanceRepository.findByIdentityHashOrThrow(
      freeBalanceAppInstance.identityHash,
    );
    freeBalanceAppEntity.latestState = freeBalanceAppInstance.latestState;
    freeBalanceAppEntity.latestTimeout = freeBalanceAppInstance.latestTimeout;
    freeBalanceAppEntity.latestVersionNumber = freeBalanceAppInstance.latestVersionNumber;

    await getManager().transaction(async transactionalEntityManager => {
      await transactionalEntityManager.save(app);
      await transactionalEntityManager.save(freeBalanceAppEntity);
      await transactionalEntityManager
        .createQueryBuilder()
        .relation(Channel, "appInstances")
        .of(channelId)
        .remove(app.id);
    });
  }

  getAppProposal(appInstanceId: string): Promise<AppInstanceProposal> {
    return this.appInstanceRepository.getAppProposal(appInstanceId);
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
    app.initiatorDepositTokenAddress = appProposal.initiatorDepositTokenAddress;
    app.responderDeposit = bigNumberify(appProposal.responderDeposit);
    app.responderDepositTokenAddress = appProposal.responderDepositTokenAddress;
    app.timeout = bigNumberify(appProposal.timeout).toNumber();
    app.proposedToIdentifier = appProposal.proposedToIdentifier;
    app.proposedByIdentifier = appProposal.proposedByIdentifier;
    app.outcomeType = appProposal.outcomeType;
    app.meta = appProposal.meta;
    app.initialState = {};
    app.latestState = {};
    app.latestTimeout = 0;
    app.latestVersionNumber = 0;

    channel.monotonicNumProposedApps = numProposedApps;
    channel.appInstances.push(app);
    await this.channelRepository.save(channel);
  }

  async removeAppProposal(multisigAddress: string, appInstanceId: string): Promise<void> {
    // called in protocol during install and reject protocols
    // but we dont "remove" app proposals, they get upgraded. so
    // simply return without editing, and set the status to `REJECTED`
    // in the listener
    const app = await this.appInstanceRepository.findByIdentityHash(appInstanceId);
    if (!app || app.type !== AppType.PROPOSAL) {
      throw new Error(`No app proposal existed for ${appInstanceId}`);
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

  getSetStateCommitment(appIdentityHash: string): Promise<SetStateCommitmentJSON | undefined> {
    return this.setStateCommitmentRepository.getLatestSetStateCommitment(appIdentityHash);
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
    entity.timeout = commitment.timeout;
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
      timeout,
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
        timeout,
        versionNumber,
      })
      .where('set_state_commitment."appId" = (' + subQuery.getQuery() + ")")
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
    const commitmentEntity = new ConditionalTransactionCommitment();
    commitmentEntity.app = app;
    commitmentEntity.freeBalanceAppIdentityHash = commitment.freeBalanceAppIdentityHash;
    commitmentEntity.multisigAddress = commitment.multisigAddress;
    commitmentEntity.multisigOwners = commitment.multisigOwners;
    commitmentEntity.interpreterAddr = commitment.interpreterAddr;
    commitmentEntity.interpreterParams = commitment.interpreterParams;
    commitmentEntity.signatures = commitment.signatures;
    await this.conditionalTransactionCommitmentRepository.save(commitmentEntity);
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
}
