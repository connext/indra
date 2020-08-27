import { AppInstanceJson } from "@connext/types";
import { toBN, toBNJson } from "@connext/utils";
import { Test } from "@nestjs/testing";
import { TypeOrmModule } from "@nestjs/typeorm";
import { getConnection } from "typeorm";

import { AppInstanceRepository } from "../appInstance/appInstance.repository";
import { ChannelRepository } from "../channel/channel.repository";
import { SetStateCommitmentRepository } from "../setStateCommitment/setStateCommitment.repository";
import { WithdrawCommitmentRepository } from "../withdrawCommitment/withdrawCommitment.repository";
import { SetupCommitmentRepository } from "../setupCommitment/setupCommitment.repository";
import { ConditionalTransactionCommitmentRepository } from "../conditionalCommitment/conditionalCommitment.repository";
import { ConfigModule } from "../config/config.module";
import { DatabaseModule } from "../database/database.module";
import { LoggerModule } from "../logger/logger.module";
import {
  createAppInstanceJson,
  createChallengeUpdatedEventPayload,
  createConditionalTransactionCommitmentJSON,
  createSetStateCommitmentJSON,
  createStateProgressedEventPayload,
  createStoredAppChallenge,
  createTestStateChannelJSONs,
  expect,
  createTestChannel,
  createTestChannelWithAppInstance,
  createTestChallengeWithAppInstanceAndChannel,
} from "../test/utils";
import { ConfigService } from "../config/config.service";

import { CFCoreRecordRepository } from "./cfCore.repository";
import { CFCoreStore } from "./cfCore.store";
import { ChallengeRepository, ProcessedBlockRepository } from "../challenge/challenge.repository";
import { CacheModule } from "../caching/cache.module";
import { CacheService } from "../caching/cache.service";
import { AppType } from "../appInstance/appInstance.entity";

describe("CFCoreStore", () => {
  let cfCoreStore: CFCoreStore;
  let configService: ConfigService;
  let channelRepository: ChannelRepository;
  let appRepository: AppInstanceRepository;
  let cacheService: CacheService;
  let chainId: number;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [CFCoreStore],
      imports: [
        ConfigModule,
        DatabaseModule,
        LoggerModule,
        TypeOrmModule.forFeature([
          CFCoreRecordRepository,
          ChannelRepository,
          AppInstanceRepository,
          ConditionalTransactionCommitmentRepository,
          SetStateCommitmentRepository,
          WithdrawCommitmentRepository,
          SetupCommitmentRepository,
          ChallengeRepository,
          ProcessedBlockRepository,
        ]),
        CacheModule,
      ],
    }).compile();

    cfCoreStore = moduleRef.get<CFCoreStore>(CFCoreStore);
    configService = moduleRef.get<ConfigService>(ConfigService);
    cacheService = moduleRef.get<CacheService>(CacheService);
    channelRepository = moduleRef.get<ChannelRepository>(ChannelRepository);
    appRepository = moduleRef.get<AppInstanceRepository>(AppInstanceRepository);
    chainId = configService.getSupportedChains()[0];
  });

  afterEach(async () => {
    await cacheService.deleteAll();
    await getConnection().dropDatabase();
    await getConnection().close();
  });

  describe("Channel", () => {
    it("createStateChannel + getStateChannel + getSetupCommitment + getSetStateCommitment", async () => {
      const nodeIdentifier = configService.getPublicIdentifier();
      const { channelJson, setupCommitment, freeBalanceUpdate } = createTestStateChannelJSONs(
        nodeIdentifier,
      );

      for (let index = 0; index < 1; index++) {
        await cfCoreStore.createStateChannel(channelJson, setupCommitment, freeBalanceUpdate);
        const channelFromStore = await cfCoreStore.getStateChannel(channelJson.multisigAddress);
        expect(channelFromStore).to.containSubset(channelJson);

        const setupCommitmentFromStore = await cfCoreStore.getSetupCommitment(
          channelJson.multisigAddress,
        );
        expect(setupCommitmentFromStore).to.containSubset(setupCommitment);

        const freeBalanceUpdateFromStore = await cfCoreStore.getSetStateCommitment(
          channelJson.freeBalanceAppInstance!.identityHash,
        );
        expect(freeBalanceUpdateFromStore).to.containSubset(freeBalanceUpdate);
      }
    });

    it("incrementNumProposedApps", async () => {
      const nodeIdentifier = configService.getPublicIdentifier();
      const { channelJson, setupCommitment, freeBalanceUpdate } = createTestStateChannelJSONs(
        nodeIdentifier,
      );

      await cfCoreStore.createStateChannel(channelJson, setupCommitment, freeBalanceUpdate);
      await cfCoreStore.updateNumProposedApps(
        channelJson.multisigAddress,
        channelJson.monotonicNumProposedApps + 1,
        { ...channelJson, monotonicNumProposedApps: channelJson.monotonicNumProposedApps + 1 },
      );
      const channelFromStore = await cfCoreStore.getStateChannel(channelJson.multisigAddress);
      const userIdentifier = channelJson.userIdentifiers.find((x) => x !== nodeIdentifier);
      expect(channelFromStore).to.containSubset({
        ...channelJson,
        monotonicNumProposedApps: channelJson.monotonicNumProposedApps + 1,
        userIdentifiers: [nodeIdentifier, userIdentifier],
        freeBalanceAppInstance: {
          ...channelJson.freeBalanceAppInstance,
          initiatorIdentifier: nodeIdentifier,
          responderIdentifier: userIdentifier,
        },
      });
    });
  });

  describe("App Proposal", () => {
    it("createAppProposal", async () => {
      const { multisigAddress } = await createTestChannel(
        cfCoreStore,
        configService.getPublicIdentifier(),
      );

      const appProposal = createAppInstanceJson({ appSeqNo: 2, multisigAddress });
      const setStateCommitment = createSetStateCommitmentJSON({
        appIdentityHash: appProposal.identityHash,
      });

      const conditionalTx = createConditionalTransactionCommitmentJSON({
        appIdentityHash: appProposal.identityHash,
        contractAddresses: configService.getContractAddresses(chainId),
      });

      for (let index = 0; index < 3; index++) {
        await cfCoreStore.createAppProposal(
          multisigAddress,
          appProposal,
          2,
          setStateCommitment,
          conditionalTx,
        );

        const received = await cfCoreStore.getAppProposal(appProposal.identityHash);
        expect(received).to.containSubset(appProposal);

        const channel = await cfCoreStore.getStateChannel(multisigAddress);
        expect(channel.proposedAppInstances.length).to.equal(1);
        const proposedMap = new Map(channel.proposedAppInstances);
        expect(proposedMap.has(appProposal.identityHash)).to.be.true;
        expect(proposedMap.get(appProposal.identityHash)).to.containSubset(appProposal);

        const setStateCommitmentFromStore = await cfCoreStore.getSetStateCommitment(
          appProposal.identityHash,
        );
        expect(setStateCommitmentFromStore).to.containSubset(setStateCommitment);

        const conditionalTxFromStore = await cfCoreStore.getConditionalTransactionCommitment(
          appProposal.identityHash,
        );
        expect(conditionalTxFromStore).to.containSubset(conditionalTx);
      }
    });

    it("removeAppProposal", async () => {
      const { multisigAddress } = await createTestChannel(
        cfCoreStore,
        configService.getPublicIdentifier(),
      );

      // make sure it got unbound in the db
      let channelEntity = await channelRepository.findByMultisigAddressOrThrow(multisigAddress);
      expect(channelEntity.appInstances.length).to.equal(1);

      const appProposal = createAppInstanceJson({ multisigAddress });
      await cfCoreStore.createAppProposal(
        multisigAddress,
        appProposal,
        2,
        createSetStateCommitmentJSON({ appIdentityHash: appProposal.identityHash }),
        createConditionalTransactionCommitmentJSON({ appIdentityHash: appProposal.identityHash }),
      );

      channelEntity = await channelRepository.findByMultisigAddressOrThrow(multisigAddress);
      expect(channelEntity.appInstances.length).to.equal(2);

      for (let index = 0; index < 4; index++) {
        await cfCoreStore.removeAppProposal(multisigAddress, appProposal.identityHash);

        // make sure it got unbound in the db
        channelEntity = await channelRepository.findByMultisigAddressOrThrow(multisigAddress);
        expect(channelEntity.appInstances.length).to.equal(1);

        const channel = await cfCoreStore.getStateChannel(multisigAddress);
        expect(channel.proposedAppInstances.length).to.equal(0);
      }
    });
  });

  describe("App Instance", () => {
    // this test is currently skipped because the sync protocol needs to be able to install apps that do
    // not have proposals in some cases.
    // TODO: revisit this at some point
    it.skip("should not create an app instance if there is no app proposal", async () => {
      const { multisigAddress, channelJson } = await createTestChannel(
        cfCoreStore,
        configService.getPublicIdentifier(),
      );

      const appInstance = createAppInstanceJson();
      const updatedFreeBalance: AppInstanceJson = {
        ...channelJson.freeBalanceAppInstance!,
        latestState: { appState: "updated" },
      };
      await expect(
        cfCoreStore.createAppInstance(
          multisigAddress,
          appInstance,
          updatedFreeBalance,
          createSetStateCommitmentJSON(),
        ),
      ).to.be.rejectedWith(/Operation could not be completed/);
    });

    it("createAppInstance", async () => {
      const APP_SEQ_NO = 2;

      const {
        multisigAddress,
        channelJson,
        userIdentifier,
        freeBalanceUpdate,
      } = await createTestChannel(cfCoreStore, configService.getPublicIdentifier());

      const appProposal = createAppInstanceJson({
        appSeqNo: APP_SEQ_NO,
        initiatorIdentifier: userIdentifier,
        responderIdentifier: configService.getPublicIdentifier(),
        multisigAddress,
      });
      const setStateCommitment = createSetStateCommitmentJSON({
        appIdentityHash: appProposal.identityHash,
      });
      const conditionalTx = createConditionalTransactionCommitmentJSON({
        appIdentityHash: appProposal.identityHash,
      });
      await cfCoreStore.createAppProposal(
        multisigAddress,
        appProposal,
        APP_SEQ_NO,
        setStateCommitment,
        conditionalTx,
      );

      const userParticipantAddr = userIdentifier;
      const nodeParticipantAddr = configService.getPublicIdentifier();

      const appInstance = createAppInstanceJson({
        appSeqNo: APP_SEQ_NO,
        identityHash: appProposal.identityHash,
        initiatorIdentifier: userParticipantAddr,
        multisigAddress,
        responderIdentifier: nodeParticipantAddr,
      });
      const updatedFreeBalance: AppInstanceJson = {
        ...channelJson.freeBalanceAppInstance!,
        latestState: { appState: "updated" },
      };
      const updatedFreeBalanceCommitment = createSetStateCommitmentJSON({
        ...freeBalanceUpdate,
        versionNumber: toBNJson(100),
      });

      for (let index = 0; index < 3; index++) {
        await cfCoreStore.createAppInstance(
          multisigAddress,
          appInstance,
          updatedFreeBalance,
          updatedFreeBalanceCommitment,
        );
        const app = await cfCoreStore.getAppInstance(appInstance.identityHash);
        expect(app).to.containSubset(appInstance);

        const updatedFreeBalanceCommitmentFromStore = await cfCoreStore.getSetStateCommitment(
          channelJson.freeBalanceAppInstance!.identityHash,
        );
        expect(updatedFreeBalanceCommitmentFromStore).to.containSubset(
          updatedFreeBalanceCommitment,
        );

        const channel = await cfCoreStore.getStateChannel(multisigAddress);
        expect(channel).to.containSubset({
          ...channelJson,
          freeBalanceAppInstance: updatedFreeBalance,
          appInstances: [[appInstance.identityHash, appInstance]],
          monotonicNumProposedApps: 2,
        });
      }
    });

    it("updateAppInstance", async () => {
      const { multisigAddress, appInstance } = await createTestChannelWithAppInstance(
        cfCoreStore,
        configService.getPublicIdentifier(),
      );

      const updated = createAppInstanceJson({
        ...appInstance,
        latestState: { updated: "updated app instance" },
        latestVersionNumber: 42,
        stateTimeout: toBN(1142).toHexString(),
        defaultTimeout: "0x00",
      });

      const updatedSetStateCommitment = createSetStateCommitmentJSON({
        appIdentityHash: appInstance.identityHash,
        versionNumber: toBNJson(updated.latestVersionNumber),
      });

      for (let index = 0; index < 3; index++) {
        await cfCoreStore.updateAppInstance(multisigAddress, updated, updatedSetStateCommitment);
        const app = await cfCoreStore.getAppInstance(appInstance.identityHash);
        expect(app).to.containSubset(updated);

        const updatedSetStateCommitmentFromStore = await cfCoreStore.getSetStateCommitment(
          appInstance.identityHash,
        );
        expect(updatedSetStateCommitmentFromStore).to.containSubset(updatedSetStateCommitment);
      }
    });

    it("removeAppInstance", async () => {
      const { multisigAddress, channelJson, appInstance } = await createTestChannelWithAppInstance(
        cfCoreStore,
        configService.getPublicIdentifier(),
      );

      const updatedFreeBalance: AppInstanceJson = {
        ...channelJson.freeBalanceAppInstance!,
        latestState: { appState: "removed app instance" },
      };
      const updatedFreeBalanceCommitment = createSetStateCommitmentJSON({
        appIdentityHash: channelJson.freeBalanceAppInstance!.identityHash,
        versionNumber: toBNJson(chainId),
      });

      for (let index = 0; index < 3; index++) {
        await cfCoreStore.removeAppInstance(
          multisigAddress,
          appInstance,
          updatedFreeBalance,
          updatedFreeBalanceCommitment,
        );

        // make sure it got unbound in the db
        const channelEntity = await channelRepository.findByMultisigAddressOrThrow(multisigAddress);
        expect(channelEntity.appInstances.length).to.equal(1);

        // verify app commitments are also removed
        const conditional = await cfCoreStore.getConditionalTransactionCommitment(
          appInstance.identityHash,
        );
        expect(conditional).to.be.undefined;
        const setState = await cfCoreStore.getSetStateCommitments(appInstance.identityHash);
        expect(setState).to.be.deep.eq([]);

        const channel = await cfCoreStore.getStateChannel(multisigAddress);
        expect(channel.appInstances.length).to.equal(0);
        expect(channel).to.containSubset({
          ...channelJson,
          freeBalanceAppInstance: updatedFreeBalance,
          monotonicNumProposedApps: 2,
        });
        const app = await appRepository.findByIdentityHash(appInstance.identityHash);
        expect(app.type).to.be.eq(AppType.UNINSTALLED);
        expect(app.latestState).to.containSubset(appInstance.latestState);
        expect(app.stateTimeout).to.be.eq(appInstance.stateTimeout);
        expect(app.latestVersionNumber).to.be.eq(appInstance.latestVersionNumber);
      }
    });
  });

  describe("Challenges", () => {
    it("creates a challenge", async () => {
      const { appInstance } = await createTestChannelWithAppInstance(
        cfCoreStore,
        configService.getPublicIdentifier(),
      );
      const challenge = createStoredAppChallenge({
        identityHash: appInstance.identityHash,
      });
      await cfCoreStore.saveAppChallenge(challenge);
      const retrieved = await cfCoreStore.getAppChallenge(challenge.identityHash);
      expect(retrieved).to.containSubset(challenge);
      const byChannel = await cfCoreStore.getActiveChallenges();
      expect(byChannel).to.containSubset([challenge]);
    });

    it("updates a challenge", async () => {
      const { challenge } = await createTestChallengeWithAppInstanceAndChannel(
        cfCoreStore,
        configService.getPublicIdentifier(),
      );
      const updated = {
        ...challenge,
        versionNumber: toBN(5),
      };
      await cfCoreStore.saveAppChallenge(updated);
      const retrieved = await cfCoreStore.getAppChallenge(challenge.identityHash);
      expect(retrieved).to.containSubset(updated);
    });
  });

  describe("State Progressed Event", () => {
    it("creates a state progressed event", async () => {
      const { appInstance } = await createTestChallengeWithAppInstanceAndChannel(
        cfCoreStore,
        configService.getPublicIdentifier(),
      );
      const event = createStateProgressedEventPayload({
        identityHash: appInstance.identityHash,
      });
      await cfCoreStore.createStateProgressedEvent(event);
      const retrieved = await cfCoreStore.getStateProgressedEvents(appInstance.identityHash);
      expect(retrieved).to.containSubset([event]);
    });
  });

  describe("Challenge updated Event", () => {
    it("creates a challenge updated event", async () => {
      const { appInstance } = await createTestChallengeWithAppInstanceAndChannel(
        cfCoreStore,
        configService.getPublicIdentifier(),
      );
      const event = createChallengeUpdatedEventPayload({
        identityHash: appInstance.identityHash,
      });
      await cfCoreStore.createChallengeUpdatedEvent(event);
      const retrieved = await cfCoreStore.getChallengeUpdatedEvents(appInstance.identityHash);
      expect(retrieved).to.containSubset([event]);
    });
  });
});
