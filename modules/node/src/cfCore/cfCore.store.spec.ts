import { AppInstanceJson } from "@connext/types";
import { toBN, toBNJson, delay } from "@connext/utils";
import { Test } from "@nestjs/testing";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AddressZero } from "ethers/constants";
import { bigNumberify } from "ethers/utils";
import { getConnection } from "typeorm";

import { AppInstanceRepository } from "../appInstance/appInstance.repository";
import { AppRegistryRepository } from "../appRegistry/appRegistry.repository";
import { ChannelRepository } from "../channel/channel.repository";
import { SetStateCommitmentRepository } from "../setStateCommitment/setStateCommitment.repository";
import { WithdrawCommitmentRepository } from "../withdrawCommitment/withdrawCommitment.repository";
import { SetupCommitmentRepository } from "../setupCommitment/setupCommitment.repository";
import { ConditionalTransactionCommitmentRepository } from "../conditionalCommitment/conditionalCommitment.repository";
import { ConfigModule } from "../config/config.module";
import { DatabaseModule } from "../database/database.module";
import { mkHash, mkAddress } from "../test/utils";
import {
  createStateChannelJSON,
  generateRandomAddress,
  createAppInstanceProposal,
  createAppInstanceJson,
  createSetStateCommitmentJSON,
  createConditionalTransactionCommitmentJSON,
  generateRandomSignature,
  createMinimalTransaction,
  createStoredAppChallenge,
  createStateProgressedEventPayload,
  createChallengeUpdatedEventPayload,
} from "../test/cfCore";
import { ConfigService } from "../config/config.service";

import { CFCoreRecordRepository } from "./cfCore.repository";
import { CFCoreStore } from "./cfCore.store";
import { ChallengeRepository, ProcessedBlockRepository } from "../challenge/challenge.repository";

const createTestChannel = async (
  cfCoreStore: CFCoreStore,
  nodeIdentifier: string,
  userIdentifier: string = generateRandomAddress(),
  multisigAddress: string = generateRandomAddress(),
) => {
  await cfCoreStore.createSetupCommitment(multisigAddress, {
    data: "",
    to: AddressZero,
    value: 0,
  });

  const channelJson = createStateChannelJSON({
    multisigAddress,
    userIdentifiers: [nodeIdentifier, userIdentifier],
  });
  await cfCoreStore.createStateChannel(channelJson);

  return { multisigAddress, userIdentifier, channelJson };
};

const createTestChannelWithAppInstance = async (
  cfCoreStore: CFCoreStore,
  nodeIdentifier: string,
  userIdentifier: string = generateRandomAddress(),
  multisigAddress: string = generateRandomAddress(),
) => {
  await cfCoreStore.createSetupCommitment(multisigAddress, {
    data: "",
    to: AddressZero,
    value: 0,
  });

  const channelJson = createStateChannelJSON({
    multisigAddress,
    userIdentifiers: [nodeIdentifier, userIdentifier],
  });
  await cfCoreStore.createStateChannel(channelJson);

  const appProposal = createAppInstanceProposal({ appSeqNo: 2 });
  await cfCoreStore.createAppProposal(multisigAddress, appProposal, 2);

  const userParticipantAddr = userIdentifier;
  const nodeParticipantAddr = nodeIdentifier;

  const appInstance = createAppInstanceJson({
    identityHash: appProposal.identityHash,
    multisigAddress,
    initiatorIdentifier: userParticipantAddr,
    responderIdentifier: nodeParticipantAddr,
  });
  const updatedFreeBalance: AppInstanceJson = {
    ...channelJson.freeBalanceAppInstance!,
    latestState: { appState: "created app instance" },
  };
  await cfCoreStore.createAppInstance(multisigAddress, appInstance, updatedFreeBalance);

  return {
    multisigAddress,
    userIdentifier,
    channelJson,
    appInstance,
    updatedFreeBalance,
  };
};

const createTestChallengeWithAppInstanceAndChannel = async (
  cfCoreStore: CFCoreStore,
  nodeIdentifier: string,
  userIdentifierParam: string = generateRandomAddress(),
  multisigAddressParam: string = generateRandomAddress(),
) => {
  const {
    multisigAddress,
    userIdentifier,
    channelJson,
    appInstance,
    updatedFreeBalance,
  } = await createTestChannelWithAppInstance(
    cfCoreStore,
    nodeIdentifier,
    userIdentifierParam,
    multisigAddressParam,
  );

  // add challenge
  const challenge = createStoredAppChallenge({
    identityHash: appInstance.identityHash,
  });
  await cfCoreStore.createAppChallenge(challenge.identityHash, challenge);

  return {
    challenge,
    multisigAddress,
    userIdentifier,
    channelJson,
    appInstance,
    updatedFreeBalance,
  };
};

describe("CFCoreStore", () => {
  let cfCoreStore: CFCoreStore;
  let configService: ConfigService;
  let channelRepository: ChannelRepository;
  let challengeRepository: ChallengeRepository;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [CFCoreStore],
      imports: [
        ConfigModule,
        DatabaseModule,
        TypeOrmModule.forFeature([
          CFCoreRecordRepository,
          AppRegistryRepository,
          ChannelRepository,
          AppInstanceRepository,
          ConditionalTransactionCommitmentRepository,
          SetStateCommitmentRepository,
          WithdrawCommitmentRepository,
          SetupCommitmentRepository,
          ChallengeRepository,
          ProcessedBlockRepository,
        ]),
      ],
    }).compile();

    cfCoreStore = moduleRef.get<CFCoreStore>(CFCoreStore);
    configService = moduleRef.get<ConfigService>(ConfigService);
    channelRepository = moduleRef.get<ChannelRepository>(ChannelRepository);
    challengeRepository = moduleRef.get<ChallengeRepository>(ChallengeRepository);
  });

  afterEach(async () => {
    await getConnection().dropDatabase();
    await getConnection().close();
  });

  describe("Channel", () => {
    it("should create a state channel", async () => {
      const nodeIdentifier = configService.getPublicIdentifier();
      const { multisigAddress, channelJson } = await createTestChannel(cfCoreStore, nodeIdentifier);

      let channel = await cfCoreStore.getStateChannel(multisigAddress);
      const userIdentifier = channelJson.userIdentifiers.find(x => x !== nodeIdentifier);
      expect(channel).toMatchObject({
        ...channelJson,
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
    it("should create an app proposal", async () => {
      const { multisigAddress } = await createTestChannel(
        cfCoreStore,
        configService.getPublicIdentifier(),
      );

      const appProposal = createAppInstanceProposal({ appSeqNo: 2 });
      await cfCoreStore.createAppProposal(multisigAddress, appProposal, 2);

      const received = await cfCoreStore.getAppProposal(appProposal.identityHash);
      expect(received).toMatchObject(appProposal);

      const channel = await cfCoreStore.getStateChannel(multisigAddress);
      expect(channel.proposedAppInstances.length).toEqual(1);
      const proposedMap = new Map(channel.proposedAppInstances);
      expect(proposedMap.has(appProposal.identityHash)).toBeTruthy();
      expect(proposedMap.get(appProposal.identityHash)).toMatchObject(appProposal);
    });

    it("should remove an app proposal", async () => {
      const { multisigAddress } = await createTestChannel(
        cfCoreStore,
        configService.getPublicIdentifier(),
      );

      // make sure it got unbound in the db
      let channelEntity = await channelRepository.findByMultisigAddressOrThrow(multisigAddress);
      expect(channelEntity.appInstances.length).toEqual(1);

      const appProposal = createAppInstanceProposal();
      await cfCoreStore.createAppProposal(multisigAddress, appProposal, 2);

      channelEntity = await channelRepository.findByMultisigAddressOrThrow(multisigAddress);
      expect(channelEntity.appInstances.length).toEqual(2);

      await cfCoreStore.removeAppProposal(multisigAddress, appProposal.identityHash);

      // make sure it got unbound in the db
      channelEntity = await channelRepository.findByMultisigAddressOrThrow(multisigAddress);
      expect(channelEntity.appInstances.length).toEqual(1);

      const channel = await cfCoreStore.getStateChannel(multisigAddress);
      expect(channel.proposedAppInstances.length).toEqual(0);
    });
  });

  describe("App Instance", () => {
    it("should not create an app instance if there is no app proposal", async () => {
      const { multisigAddress, channelJson } = await createTestChannel(
        cfCoreStore,
        configService.getPublicIdentifier(),
      );

      const appInstance = createAppInstanceJson();
      const updatedFreeBalance: AppInstanceJson = {
        ...channelJson.freeBalanceAppInstance!,
        latestState: { appState: "updated" },
      };
      expect(
        cfCoreStore.createAppInstance(multisigAddress, appInstance, updatedFreeBalance),
      ).rejects.toThrowError(/Could not find app with identity hash/);
    });

    it("should create app instance", async () => {
      const APP_SEQ_NO = 2;

      const { multisigAddress, channelJson, userIdentifier } = await createTestChannel(
        cfCoreStore,
        configService.getPublicIdentifier(),
      );

      const appProposal = createAppInstanceProposal({
        appSeqNo: APP_SEQ_NO,
        initiatorIdentifier: userIdentifier,
        responderIdentifier: configService.getPublicIdentifier(),
      });
      await cfCoreStore.createAppProposal(multisigAddress, appProposal, APP_SEQ_NO);

      const userParticipantAddr = userIdentifier;
      const nodeParticipantAddr = configService.getPublicIdentifier();

      const appInstance = createAppInstanceJson({
        identityHash: appProposal.identityHash,
        multisigAddress,
        initiatorIdentifier: userParticipantAddr,
        responderIdentifier: nodeParticipantAddr,
        appSeqNo: APP_SEQ_NO,
      });
      const updatedFreeBalance: AppInstanceJson = {
        ...channelJson.freeBalanceAppInstance!,
        latestState: { appState: "updated" },
      };
      await cfCoreStore.createAppInstance(multisigAddress, appInstance, updatedFreeBalance);
      const app = await cfCoreStore.getAppInstance(appInstance.identityHash);
      expect(app).toMatchObject(appInstance);

      const channel = await cfCoreStore.getStateChannel(multisigAddress);
      expect(channel).toMatchObject({
        ...channelJson,
        freeBalanceAppInstance: updatedFreeBalance,
        appInstances: [[appInstance.identityHash, appInstance]],
        monotonicNumProposedApps: 2,
      });
    });

    it("should update app instance", async () => {
      const APP_SEQ_NO = 2;

      const { multisigAddress, channelJson, userIdentifier } = await createTestChannel(
        cfCoreStore,
        configService.getPublicIdentifier(),
      );

      const appProposal = createAppInstanceProposal({
        appSeqNo: APP_SEQ_NO,
        initiatorIdentifier: userIdentifier,
        responderIdentifier: configService.getPublicIdentifier(),
      });
      await cfCoreStore.createAppProposal(multisigAddress, appProposal, APP_SEQ_NO);

      const userParticipantAddr = userIdentifier;
      const nodeParticipantAddr = configService.getPublicIdentifier();

      const appInstance = createAppInstanceJson({
        identityHash: appProposal.identityHash,
        multisigAddress,
        initiatorIdentifier: userParticipantAddr,
        responderIdentifier: nodeParticipantAddr,
        appSeqNo: APP_SEQ_NO,
      });
      await cfCoreStore.createAppInstance(
        multisigAddress,
        appInstance,
        channelJson.freeBalanceAppInstance!,
      );

      const updated = createAppInstanceJson({
        ...appInstance,
        latestState: { updated: "updated app instance" },
        latestVersionNumber: 42,
        stateTimeout: toBN(1142).toHexString(),
        defaultTimeout: "0x00",
      });

      await cfCoreStore.updateAppInstance(multisigAddress, updated);
      const app = await cfCoreStore.getAppInstance(appInstance.identityHash);
      expect(app).toMatchObject(updated);
    });

    it("should remove an app instance", async () => {
      const { multisigAddress, channelJson, appInstance } = await createTestChannelWithAppInstance(
        cfCoreStore,
        configService.getPublicIdentifier(),
      );

      const updatedFreeBalance: AppInstanceJson = {
        ...channelJson.freeBalanceAppInstance!,
        latestState: { appState: "removed app instance" },
      };
      await cfCoreStore.removeAppInstance(
        multisigAddress,
        appInstance.identityHash,
        updatedFreeBalance,
      );

      // make sure it got unbound in the db
      const channelEntity = await channelRepository.findByMultisigAddressOrThrow(multisigAddress);
      expect(channelEntity.appInstances.length).toEqual(1);

      const channel = await cfCoreStore.getStateChannel(multisigAddress);
      expect(channel.appInstances.length).toEqual(0);
      expect(channel).toMatchObject({
        ...channelJson,
        freeBalanceAppInstance: updatedFreeBalance,
        monotonicNumProposedApps: 2,
      });
    });
  });

  describe("Set State Commitment", () => {
    it("creates a set state commitment", async () => {
      const { appInstance } = await createTestChannelWithAppInstance(
        cfCoreStore,
        configService.getPublicIdentifier(),
      );
      const setStateCommitment = createSetStateCommitmentJSON({
        appIdentityHash: appInstance.identityHash,
      });
      await cfCoreStore.createSetStateCommitment(
        setStateCommitment.appIdentityHash,
        setStateCommitment,
      );
      const retrieved = await cfCoreStore.getSetStateCommitments(
        setStateCommitment.appIdentityHash,
      );
      expect(retrieved).toMatchObject([setStateCommitment]);
    });

    it("updates a set state commitment", async () => {
      const { appInstance } = await createTestChannelWithAppInstance(
        cfCoreStore,
        configService.getPublicIdentifier(),
      );
      const setStateCommitment = createSetStateCommitmentJSON({
        appIdentityHash: appInstance.identityHash,
      });
      await cfCoreStore.createSetStateCommitment(
        setStateCommitment.appIdentityHash,
        setStateCommitment,
      );
      const updated = createSetStateCommitmentJSON({
        ...setStateCommitment,
        appStateHash: mkHash("0xfeef"),
        versionNumber: toBNJson(42),
        stateTimeout: toBNJson(1337),
      });
      await cfCoreStore.updateSetStateCommitment(setStateCommitment.appIdentityHash, updated);

      const retrieved = await cfCoreStore.getSetStateCommitments(
        setStateCommitment.appIdentityHash,
      );
      expect(retrieved).toMatchObject([updated]);
    });
  });

  describe("Conditional Transaction Commitment", () => {
    it("creates a conditional transaction commitment", async () => {
      const { appInstance } = await createTestChannelWithAppInstance(
        cfCoreStore,
        configService.getPublicIdentifier(),
      );
      const conditionalTransactionCommitment = createConditionalTransactionCommitmentJSON({
        appIdentityHash: appInstance.identityHash,
      });
      await cfCoreStore.createConditionalTransactionCommitment(
        conditionalTransactionCommitment.appIdentityHash,
        conditionalTransactionCommitment,
      );
      const retrieved = await cfCoreStore.getConditionalTransactionCommitment(
        conditionalTransactionCommitment.appIdentityHash,
      );
      expect(retrieved).toMatchObject(conditionalTransactionCommitment);
    });

    it("updates a conditional transaction commitment", async () => {
      const { appInstance } = await createTestChannelWithAppInstance(
        cfCoreStore,
        configService.getPublicIdentifier(),
      );
      const conditionalTransactionCommitment = createConditionalTransactionCommitmentJSON({
        appIdentityHash: appInstance.identityHash,
      });
      await cfCoreStore.createConditionalTransactionCommitment(
        conditionalTransactionCommitment.appIdentityHash,
        conditionalTransactionCommitment,
      );
      const updated = createConditionalTransactionCommitmentJSON({
        ...conditionalTransactionCommitment,
        interpreterParams: "updated conditional transaction commitment",
        signatures: [generateRandomSignature(), generateRandomSignature()],
      });
      await cfCoreStore.updateConditionalTransactionCommitment(
        conditionalTransactionCommitment.appIdentityHash,
        updated,
      );

      const retrieved = await cfCoreStore.getConditionalTransactionCommitment(
        conditionalTransactionCommitment.appIdentityHash,
      );
      expect(retrieved).toMatchObject(updated);
    });
  });

  describe("Withdrawal Commitment", () => {
    it("creates a withdrawal commitment", async () => {
      const { multisigAddress } = await createTestChannelWithAppInstance(
        cfCoreStore,
        configService.getPublicIdentifier(),
      );
      const withdrawal = createMinimalTransaction();
      await cfCoreStore.createWithdrawalCommitment(multisigAddress, withdrawal);
      const retrieved = await cfCoreStore.getWithdrawalCommitment(multisigAddress);
      expect(retrieved).toMatchObject(withdrawal);
    });

    it("updates a withdrawal commitment", async () => {
      const { multisigAddress } = await createTestChannelWithAppInstance(
        cfCoreStore,
        configService.getPublicIdentifier(),
      );
      const withdrawal = createMinimalTransaction();
      await cfCoreStore.createWithdrawalCommitment(multisigAddress, withdrawal);

      const updated = createMinimalTransaction({
        to: mkAddress("0x1337"),
        data: mkHash("0xdeadbeef"),
        value: bigNumberify(42),
      });
      await cfCoreStore.updateWithdrawalCommitment(multisigAddress, updated);
      const retrieved = await cfCoreStore.getWithdrawalCommitment(multisigAddress);
      expect(retrieved).toMatchObject(updated);
    });
  });

  describe.only("Challenges", () => {
    it("creates a challenge", async () => {
      const { appInstance, multisigAddress } = await createTestChannelWithAppInstance(
        cfCoreStore,
        configService.getPublicIdentifier(),
      );
      const challenge = createStoredAppChallenge({
        identityHash: appInstance.identityHash,
      });
      await cfCoreStore.createAppChallenge(challenge.identityHash, challenge);
      const retrieved = await cfCoreStore.getAppChallenge(challenge.identityHash);
      expect(retrieved).toMatchObject(challenge);
      const byChannel = await cfCoreStore.getActiveChallenges(multisigAddress);
      expect(byChannel).toMatchObject([challenge]);
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
      await cfCoreStore.updateAppChallenge(challenge.identityHash, updated);
      const retrieved = await cfCoreStore.getAppChallenge(challenge.identityHash);
      expect(retrieved).toMatchObject(updated);
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
      await cfCoreStore.createStateProgressedEvent(appInstance.identityHash, event);
      const retrieved = await cfCoreStore.getStateProgressedEvents(appInstance.identityHash);
      expect(retrieved).toMatchObject([event]);
    });
  });

  describe.only("Challenge Updated Event", () => {
    it("creates a challenge updated event", async () => {
      const { appInstance } = await createTestChallengeWithAppInstanceAndChannel(
        cfCoreStore,
        configService.getPublicIdentifier(),
      );
      const event = createChallengeUpdatedEventPayload({
        identityHash: appInstance.identityHash,
      });

      await cfCoreStore.createChallengeUpdatedEvent(appInstance.identityHash, event);
      const retrieved = await cfCoreStore.getChallengeUpdatedEvents(appInstance.identityHash);
      expect(retrieved).toMatchObject([event]);
    });

    it("will create a challenge if none exists", async () => {
      const { appInstance } = await createTestChannelWithAppInstance(
        cfCoreStore,
        configService.getPublicIdentifier(),
      );
      const event = createChallengeUpdatedEventPayload({
        identityHash: appInstance.identityHash,
      });
      await cfCoreStore.createChallengeUpdatedEvent(appInstance.identityHash, event);
      const retrieved = await cfCoreStore.getChallengeUpdatedEvents(appInstance.identityHash);
      expect(retrieved).toMatchObject([event]);
      const challenge = await cfCoreStore.getAppChallenge(appInstance.identityHash);
      expect(challenge).toMatchObject(event);
    });
  });
});
