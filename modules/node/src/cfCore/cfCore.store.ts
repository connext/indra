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
import { getSignerAddressFromPublicIdentifier, stringify, toBN } from "@connext/utils";
import { getManager } from "typeorm";
import { BigNumber, constants, utils } from "ethers";

import {
  AppInstanceRepository,
  convertAppToInstanceJSON,
} from "../appInstance/appInstance.repository";
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
import { AppInstance, AppInstanceSerializer, AppType } from "../appInstance/appInstance.entity";
import { SetStateCommitment } from "../setStateCommitment/setStateCommitment.entity";
import { Channel, ChannelSerializer } from "../channel/channel.entity";
import { ConditionalTransactionCommitment } from "../conditionalCommitment/conditionalCommitment.entity";
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
import { instrument } from "../logger/instrument";
import { async } from "rxjs/internal/scheduler/async";

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
    return instrument("CFCoreStore:getAllChannels", async () => {
      const allChannels = await this.channelRepository.find();
      return allChannels.map((channel) => convertChannelToJSON(channel));
    });
  }

  getChannel(multisig: string): Promise<Channel> {
    return instrument("CFCoreStore:getChannel", () =>
      this.findChannelByMultisigAddressOrThrow(multisig),
    );
  }

  async getStateChannel(multisigAddress: string): Promise<StateChannelJSON> {
    return instrument("CFCoreStore:getStateChannel", async () => {
      let res;
      await instrument("getStateChannel:findChannelByMultisigAddress", async () => {
        res = await this.findChannelByMultisigAddressOrThrow(multisigAddress);
      });
      await instrument("getStateChannel:convertChannelToJSON", async () => {
        res = convertChannelToJSON(res);
      });
      return res;
    });
  }

  async getStateChannelByOwners(owners: string[]): Promise<StateChannelJSON> {
    return instrument("CFCoreStore:getStateChannelByOwners", async () => {
      if (owners.length !== 2) {
        return this.channelRepository.getStateChannelByOwners(owners);
      }
      const chan = await this.findChannelByOwners([owners[0], owners[1]]);
      return chan && convertChannelToJSON(chan);
    });
  }

  async getStateChannelByAppIdentityHash(appIdentityHash: string): Promise<StateChannelJSON> {
    return instrument("CFCoreStore:getStateChannelByAppIdentityHash", async () => {
      const chan = await this.findChannelByAppIdentityHash(appIdentityHash);
      return chan && convertChannelToJSON(chan);
    });
  }

  async createStateChannel(
    stateChannel: StateChannelJSON,
    signedSetupCommitment: MinimalTransaction,
    signedFreeBalanceUpdate: SetStateCommitmentJSON,
  ): Promise<void> {
    await instrument("CFCoreStore:createStateChannel", async () => {
      const nodeIdentifier = this.configService.getPublicIdentifier();
      const userIdentifier = stateChannel.userIdentifiers.find((id) => id !== nodeIdentifier);

      const {
        multisigAddress,
        addresses,
        freeBalanceAppInstance,
        monotonicNumProposedApps,
      } = stateChannel;

      let channel = new Channel();
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
        `appInstance:identityHash:${freeBalanceApp.identityHash}`,
        60,
        AppInstanceSerializer.toJSON(freeBalanceApp),
      );
    });
  }

  async incrementNumProposedApps(multisigAddress: string): Promise<void> {
    return instrument("CFCoreStore:incrementNumProposedApps", async () => {
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
      await this.cache.mergeCacheValues(`channel:multisig:${multisigAddress}`, 60, {
        monotonicNumProposedApps: channel.monotonicNumProposedApps + 1,
      });
    });
  }

  async getAppProposal(appIdentityHash: string): Promise<AppInstanceJson> {
    return instrument("CFCoreStore:getAppProposal", async () => {
      const app = await this.findAppInstanceByIdentityHash(appIdentityHash);
      if (!app || app.type !== AppType.PROPOSAL) {
        return undefined;
      }
      return convertAppToInstanceJSON(app, app.channel);
    });
  }

  async createAppProposal(
    multisigAddress: string,
    appProposal: AppInstanceJson,
    numProposedApps: number,
    signedSetStateCommitment: SetStateCommitmentJSON,
    signedConditionalTxCommitment: ConditionalTransactionCommitmentJSON,
  ): Promise<void> {
    // 35 ms
    await instrument("CFCoreStore:createAppProposal", async () => {
      // because the app instance has `cascade` set to true, saving
      // the channel will involve multiple queries and should be put
      // within a transaction
      const appValues = {
        type: AppType.PROPOSAL,
        identityHash: appProposal.identityHash,
        actionEncoding: appProposal.abiEncodings.actionEncoding,
        stateEncoding: appProposal.abiEncodings.stateEncoding,
        appDefinition: appProposal.appDefinition,
        appSeqNo: appProposal.appSeqNo,
        initiatorDeposit: BigNumber.from(appProposal.initiatorDeposit),
        initiatorDepositAssetId: appProposal.initiatorDepositAssetId,
        responderDeposit: BigNumber.from(appProposal.responderDeposit),
        responderDepositAssetId: appProposal.responderDepositAssetId,
        defaultTimeout: appProposal.defaultTimeout,
        stateTimeout: appProposal.stateTimeout,
        responderIdentifier: appProposal.responderIdentifier,
        initiatorIdentifier: appProposal.initiatorIdentifier,
        outcomeType: appProposal.outcomeType,
        outcomeInterpreterParameters: appProposal.outcomeInterpreterParameters,
        meta: appProposal.meta,
        latestState: appProposal.latestState,
        latestVersionNumber: appProposal.latestVersionNumber,
        userIdentifier:
          this.configService.getPublicIdentifier() === appProposal.initiatorIdentifier
            ? appProposal.responderIdentifier
            : appProposal.initiatorIdentifier,
        nodeIdentifier: this.configService.getPublicIdentifier(),
      };

      // 20 ms
      await instrument("createAppProposal:tx", () =>
        getManager().transaction(async (transactionalEntityManager) => {
          await instrument("createAppProposal:CreateApp", async () => {
            await transactionalEntityManager
              .createQueryBuilder()
              .insert()
              .into(AppInstance)
              .values(appValues)
              .onConflict(`("identityHash") DO NOTHING`)
              .execute();
          });

          // 2ms
          await instrument("createAppProposal:LinkAppToChannel", async () => {
            await transactionalEntityManager
              .createQueryBuilder()
              .relation(Channel, "appInstances")
              .of(multisigAddress)
              .add(appProposal.identityHash);
          });

          // TODO can this be merged with above?
          // 1.5ms
          await instrument("createAppProposal:setNumProposedApps", async () => {
            await transactionalEntityManager
              .createQueryBuilder()
              .update(Channel)
              .set({
                monotonicNumProposedApps: numProposedApps,
              })
              .where("multisigAddress = :multisigAddress", { multisigAddress })
              .execute();
          });

          await instrument("createAppProposal:SetStateCommitment", async () => {
            await transactionalEntityManager
              .createQueryBuilder()
              .insert()
              .into(SetStateCommitment)
              .values({
                appIdentityHash: appProposal.identityHash,
                appIdentity: signedSetStateCommitment.appIdentity,
                appStateHash: signedSetStateCommitment.appStateHash,
                challengeRegistryAddress: signedSetStateCommitment.challengeRegistryAddress,
                signatures: signedSetStateCommitment.signatures,
                stateTimeout: toBN(signedSetStateCommitment.stateTimeout).toString(),
                versionNumber: toBN(signedSetStateCommitment.versionNumber).toNumber(),
              })
              .onConflict(`("appIdentityHash") DO NOTHING`)
              .execute();
          });

          await instrument("createAppProposal:ConditionalTxCommitment", async () => {
            await transactionalEntityManager
              .createQueryBuilder()
              .insert()
              .into(ConditionalTransactionCommitment)
              .values({
                freeBalanceAppIdentityHash:
                  signedConditionalTxCommitment.freeBalanceAppIdentityHash,
                multisigAddress: signedConditionalTxCommitment.multisigAddress,
                multisigOwners: signedConditionalTxCommitment.multisigOwners,
                interpreterAddr: signedConditionalTxCommitment.interpreterAddr,
                interpreterParams: signedConditionalTxCommitment.interpreterParams,
                signatures: signedConditionalTxCommitment.signatures,
                appIdentityHash: appProposal.identityHash,
              })
              .onConflict(`("appIdentityHash") DO NOTHING`)
              .execute();
          });

          // 1.6 ms
          await instrument("createAppProposal:cacheSet", async () => {
            // Update cache values

            // TODO: do we need anything else from channel?
            await this.cache.mergeCacheValues(
              `appInstance:identityHash:${appProposal.identityHash}`,
              60,
              appValues,
            );

            // TODO: this is messed up, if we change this back to cache.del everything is way faster
            await this.cache.mergeCacheValuesFn(
              `channel:multisig:${multisigAddress}`,
              60,
              (channel: Channel) => {
                console.log("channel: ", channel);
                const exists = channel.appInstances.findIndex(
                  (app) => app.identityHash === appProposal.identityHash,
                );
                console.log("exists: ", exists);
                if (exists !== -1) {
                  channel.appInstances[exists] = appValues as any;
                } else {
                  channel.appInstances.push(appValues as any);
                }
                return channel;
              },
            );
          });
        }),
      );
    });
  }

  async removeAppProposal(multisigAddress: string, appIdentityHash: string): Promise<void> {
    await instrument("CFCoreStore:removeAppProposal", async () => {
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

        await this.cache.mergeCacheValues(
          `appInstance:identityHash:${appIdentityHash}`,
          60,
          AppInstanceSerializer.toJSON(app),
        );
        await this.cache.del(`channel:multisig:${multisigAddress}`);
      });
    });
  }

  async getAppInstance(appIdentityHash: string): Promise<AppInstanceJson> {
    return instrument("CFCoreStore:getAppInstance", async () => {
      const res = await this.findAppInstanceByIdentityHashOrThrow(appIdentityHash);
      return res && convertAppToInstanceJSON(res, res.channel);
    });
  }

  async createAppInstance(
    multisigAddress: string,
    appJson: AppInstanceJson,
    freeBalanceAppInstance: AppInstanceJson,
    signedFreeBalanceUpdate: SetStateCommitmentJSON,
  ): Promise<void> {
    await instrument("CFCoreStore:createAppInstance", async () => {
      const {
        identityHash,
        initiatorIdentifier,
        responderIdentifier,
        latestState,
        stateTimeout,
        latestVersionNumber,
      } = appJson;

      const nodeId = this.configService.getPublicIdentifier();
      const update = {
        type: AppType.INSTANCE,
        userIdentifier: [initiatorIdentifier, responderIdentifier].find((p) => p !== nodeId),
        nodeIdentifier: [initiatorIdentifier, responderIdentifier].find((p) => p === nodeId),
        latestState: latestState,
        stateTimeout: stateTimeout,
        latestVersionNumber: latestVersionNumber,
      };

      // 25ms
      await instrument("createAppInstance:tx", async () => {
        await getManager().transaction(async (transactionalEntityManager) => {
          // 8ms
          await instrument("createAppInstance:updateAppInstance", async () => {
            await transactionalEntityManager
              .createQueryBuilder()
              .update(AppInstance)
              .set(update)
              .where("identityHash = :identityHash", {
                identityHash,
              })
              .execute();
          });

          // 3ms
          await instrument("createAppInstance:tx:updateFreeBalanace", async () => {
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

          // 2ms
          await instrument("createAppInstance:tx:updateAppMultisigAddress", async () => {
            await transactionalEntityManager
              .createQueryBuilder()
              .relation(AppInstance, "channel")
              .of(identityHash)
              .set(multisigAddress);
          });

          // 2.5ms
          await instrument("createAppInstance:tx:updateFBSetStateCommitment", async () => {
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
        });
      });

      // 1ms
      await instrument("createAppInstance:mergeCache", async () => {
        await this.cache.mergeCacheValues(
          `appInstance:identityHash:${freeBalanceAppInstance.identityHash}`,
          60,
          {
            latestState: freeBalanceAppInstance.latestState,
            stateTimeout: freeBalanceAppInstance.stateTimeout,
            latestVersionNumber: freeBalanceAppInstance.latestVersionNumber,
          },
        );
      });

      // 1ms
      // TODO: do we need anything else from channel?
      await instrument("createAppInstance:cacheSet AppInstance.identityHash", async () => {
        await this.cache.mergeCacheValues(`appInstance:identityHash:${identityHash}`, 60, {
          ...update,
          channel: { multisigAddress },
        });
      });

      // 1ms
      await instrument("createAppInstance:cacheSet channel.appIdentityHash", async () => {
        await this.cache.set(`channel:appIdentityHash:${identityHash}`, 70, multisigAddress);
      });

      // 0ms
      await instrument("createAppInstance:cacheDel", async () => {
        await this.cache.del(`channel:multisig:${multisigAddress}`);
      });
    });
  }

  async updateAppInstance(
    multisigAddress: string,
    appJson: AppInstanceJson,
    signedSetStateCommitment: SetStateCommitmentJSON,
  ): Promise<void> {
    await instrument("CFCoreStore:updateAppInstance", async () => {
      const { identityHash, latestState, stateTimeout, latestVersionNumber } = appJson;
      const app = await this.findAppInstanceByIdentityHash(identityHash);
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
      await this.cache.mergeCacheValues(`appInstance:identityHash:${identityHash}`, 60, {
        latestState,
        stateTimeout,
        latestVersionNumber,
      });
      await this.cache.set(`channel:appIdentityHash:${identityHash}`, 70, multisigAddress);
      await this.cache.del(`channel:multisig:${multisigAddress}`);
    });
  }

  async removeAppInstance(
    multisigAddress: string,
    appIdentityHash: string,
    freeBalanceAppInstance: AppInstanceJson,
    signedFreeBalanceUpdate: SetStateCommitmentJSON,
  ): Promise<void> {
    await instrument("CFCoreStore:removeAppInstance", async () => {
      let app = await this.findAppInstanceByIdentityHash(appIdentityHash);
      if (app) {
        app.type = AppType.UNINSTALLED;
        app.channel = null;
      } else {
        this.log.warn(`Could not find app instance to remove`);
      }

      await getManager().transaction(async (transactionalEntityManager) => {
        if (app) {
          app = await transactionalEntityManager.save(app);
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
      if (app) {
        await this.cache.mergeCacheValues(
          `appInstance:identityHash:${appIdentityHash}`,
          60,
          AppInstanceSerializer.toJSON(app),
        );
        await this.cache.del(`channel:multisig:${multisigAddress}`);
      }
    });
  }

  getFreeBalance(multisigAddress: string): Promise<AppInstanceJson> {
    return instrument("CFCoreStore:getFreeBalance", async () => {
      return this.appInstanceRepository.getFreeBalance(multisigAddress);
    });
  }

  getSetupCommitment(multisigAddress: string): Promise<MinimalTransaction> {
    return instrument("CFCoreStore:getSetupCommitment", async () => {
      return this.setupCommitmentRepository.getCommitment(multisigAddress);
    });
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
    return instrument("CFCoreStore:getSetStateCommitments", async () => {
      return (
        await this.setStateCommitmentRepository.findByAppIdentityHash(appIdentityHash)
      ).map((s) => setStateToJson(s));
    });
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
    return instrument("getConditionalTransactionCommitment", async () => {
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
    });
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
    const onchainChallenge = await registry.getAppChallenge(appIdentityHash);
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

  private async findAppInstanceByIdentityHash(identityHash: string) {
    return this.cache.wrap(
      `appInstance:identityHash:${identityHash}`,
      60,
      () => {
        return this.appInstanceRepository.findByIdentityHash(identityHash);
      },
      AppInstanceSerializer,
    );
  }

  private async findAppInstanceByIdentityHashOrThrow(identityHash: string) {
    const res = await this.findAppInstanceByIdentityHash(identityHash);
    if (!res) {
      throw new Error(`Could not find app with identity hash ${identityHash}`);
    }
    return res;
  }

  private async findChannelByMultisigAddress(multisig: string) {
    let cacheRes;
    await instrument("findChannelByMultisig:cacheWrap", async () => {
      cacheRes = this.cache.wrap(
        `channel:multisig:${multisig}`,
        60,
        async () => {
          let res;
          await instrument("cacheWrap:findByMultisigAddress", async () => {
            res = await this.channelRepository.findByMultisigAddress(multisig);
          });
          return res;
        },
        ChannelSerializer,
      );
    });
    return cacheRes;
  }

  private async findChannelByMultisigAddressOrThrow(multisig: string) {
    const res = await this.findChannelByMultisigAddress(multisig);
    if (!res) {
      throw new Error(`Could not find channel with multisig address ${multisig}`);
    }
    return res;
  }

  private async findChannelByAppIdentityHash(aih: string) {
    const multisig = await this.cache.get(`channel:appIdentityHash:${aih}`);
    if (multisig) {
      return this.findChannelByMultisigAddress(JSON.parse(multisig));
    }

    const chan = await this.channelRepository.findByAppIdentityHash(aih);
    if (!chan) {
      return undefined;
    }
    await this.cache.set(`channel:appIdentityHash:${aih}`, 70, chan.multisigAddress);
    await this.cache.set(
      `channel:multisig:${chan.multisigAddress}`,
      60,
      ChannelSerializer.toJSON(chan),
    );
    return chan;
  }

  private async findChannelByOwners(owners: [string, string]) {
    const canonical = this.canonicalizeOwners(owners);
    const multisig = await this.cache.get(`channel:owners:${canonical}`);
    if (multisig) {
      return this.findChannelByMultisigAddress(JSON.parse(multisig));
    }

    const chan = await this.channelRepository.findByOwners(owners);
    if (!chan) {
      return undefined;
    }
    await this.cache.set(`channel:owners:${canonical}`, 70, chan.multisigAddress);
    await this.cache.set(
      `channel:multisig:${chan.multisigAddress}`,
      60,
      ChannelSerializer.toJSON(chan),
    );
    return chan;
  }

  private canonicalizeOwners(owners: string[]) {
    if (owners.length !== 2) {
      throw new Error("sanity error - must have 2 owners");
    }

    let joiner: string[];
    if (owners[0] >= owners[1]) {
      joiner = [owners[0], owners[1]];
    } else {
      joiner = [owners[1], owners[0]];
    }
    return joiner.join(":");
  }
}
