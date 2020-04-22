import { AppInstanceJson } from "@connext/types";
import { toBN } from "@connext/utils";
import { Test } from "@nestjs/testing";
import { TypeOrmModule } from "@nestjs/typeorm";
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
import {
  createStateChannelJSON,
  generateRandomAddress,
  createAppInstanceProposal,
  createAppInstanceJson,
  createSetStateCommitmentJSON,
  createConditionalTransactionCommitmentJSON,
  createMinimalTransaction,
} from "../test/cfCore";
import { ConfigService } from "../config/config.service";

import { CFCoreRecordRepository } from "./cfCore.repository";
import { CFCoreStore } from "./cfCore.store";

const createTestChannel = async (
  cfCoreStore: CFCoreStore,
  nodeIdentifier: string,
  userIdentifier: string = generateRandomAddress(),
  multisigAddress: string = generateRandomAddress(),
) => {
  const channelJson = createStateChannelJSON({
    multisigAddress,
    userIdentifiers: [nodeIdentifier, userIdentifier],
  });
  const setupCommitment = createMinimalTransaction();
  const freeBalanceUpdate = createSetStateCommitmentJSON({
    appIdentityHash: channelJson.freeBalanceAppInstance.identityHash,
  });
  await cfCoreStore.createStateChannel(channelJson, setupCommitment, freeBalanceUpdate);

  return { multisigAddress, userIdentifier, channelJson, setupCommitment, freeBalanceUpdate };
};

const createTestChannelWithAppInstance = async (
  cfCoreStore: CFCoreStore,
  nodeIdentifier: string,
  userIdentifier: string = generateRandomAddress(),
  multisigAddress: string = generateRandomAddress(),
) => {
  const { channelJson } = await createTestChannel(
    cfCoreStore,
    nodeIdentifier,
    userIdentifier,
    multisigAddress,
  );

  const setStateCommitment = createSetStateCommitmentJSON();
  const appProposal = createAppInstanceProposal({ appSeqNo: 2 });
  await cfCoreStore.createAppProposal(multisigAddress, appProposal, 2, setStateCommitment);

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
  const freeBalanceUpdateCommitment = createSetStateCommitmentJSON({
    appIdentityHash: channelJson.freeBalanceAppInstance.identityHash,
  });
  const conditionalCommitment = createConditionalTransactionCommitmentJSON();
  await cfCoreStore.createAppInstance(
    multisigAddress,
    appInstance,
    updatedFreeBalance,
    freeBalanceUpdateCommitment,
    conditionalCommitment,
  );

  return {
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
        ]),
      ],
    }).compile();

    cfCoreStore = moduleRef.get<CFCoreStore>(CFCoreStore);
    configService = moduleRef.get<ConfigService>(ConfigService);
    channelRepository = moduleRef.get<ChannelRepository>(ChannelRepository);
  });

  afterEach(async () => {
    await getConnection().close();
  });

  describe("Channel", () => {
    it("should create a state channel", async () => {
      const nodeIdentifier = configService.getPublicIdentifier();
      const {
        multisigAddress,
        channelJson,
        setupCommitment,
        freeBalanceUpdate,
      } = await createTestChannel(cfCoreStore, nodeIdentifier);

      const channelFromStore = await cfCoreStore.getStateChannel(multisigAddress);
      const userIdentifier = channelJson.userIdentifiers.find(x => x !== nodeIdentifier);
      expect(channelFromStore).toMatchObject({
        ...channelJson,
        userIdentifiers: [nodeIdentifier, userIdentifier],
        freeBalanceAppInstance: {
          ...channelJson.freeBalanceAppInstance,
          initiatorIdentifier: nodeIdentifier,
          responderIdentifier: userIdentifier,
        },
      });

      const setupCommitmentFromStore = await cfCoreStore.getSetupCommitment(multisigAddress);
      expect(setupCommitmentFromStore).toMatchObject(setupCommitment);

      const freeBalanceUpdateFromStore = await cfCoreStore.getSetStateCommitment(
        channelJson.freeBalanceAppInstance.identityHash,
      );
      expect(freeBalanceUpdateFromStore).toMatchObject(freeBalanceUpdate);
    });
  });

  describe("App Proposal", () => {
    it("should create an app proposal", async () => {
      const { multisigAddress } = await createTestChannel(
        cfCoreStore,
        configService.getPublicIdentifier(),
      );

      const appProposal = createAppInstanceProposal({ appSeqNo: 2 });
      const setStateCommitment = createSetStateCommitmentJSON({
        appIdentityHash: appProposal.identityHash,
      });
      await cfCoreStore.createAppProposal(multisigAddress, appProposal, 2, setStateCommitment);

      const received = await cfCoreStore.getAppProposal(appProposal.identityHash);
      expect(received).toMatchObject(appProposal);

      const channel = await cfCoreStore.getStateChannel(multisigAddress);
      expect(channel.proposedAppInstances.length).toEqual(1);
      const proposedMap = new Map(channel.proposedAppInstances);
      expect(proposedMap.has(appProposal.identityHash)).toBeTruthy();
      expect(proposedMap.get(appProposal.identityHash)).toMatchObject(appProposal);

      const setStateCommitmentFromStore = await cfCoreStore.getSetStateCommitment(
        appProposal.identityHash,
      );
      expect(setStateCommitmentFromStore).toMatchObject(setStateCommitment);
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
      await cfCoreStore.createAppProposal(
        multisigAddress,
        appProposal,
        2,
        createSetStateCommitmentJSON(),
      );

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
        cfCoreStore.createAppInstance(
          multisigAddress,
          appInstance,
          updatedFreeBalance,
          createSetStateCommitmentJSON(),
          createConditionalTransactionCommitmentJSON(),
        ),
      ).rejects.toThrowError(/Could not find app with identity hash/);
    });

    it("should create app instance", async () => {
      const APP_SEQ_NO = 2;

      const {
        multisigAddress,
        channelJson,
        userIdentifier,
        freeBalanceUpdate,
      } = await createTestChannel(cfCoreStore, configService.getPublicIdentifier());

      const appProposal = createAppInstanceProposal({
        appSeqNo: APP_SEQ_NO,
        initiatorIdentifier: userIdentifier,
        responderIdentifier: configService.getPublicIdentifier(),
      });
      const setStateCommitment = createSetStateCommitmentJSON();
      await cfCoreStore.createAppProposal(
        multisigAddress,
        appProposal,
        APP_SEQ_NO,
        setStateCommitment,
      );

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
      const updatedFreeBalanceCommitment = createSetStateCommitmentJSON({
        ...freeBalanceUpdate,
        versionNumber: 100,
      });
      const conditionalTx = createConditionalTransactionCommitmentJSON({
        appIdentityHash: appInstance.identityHash,
      });
      await cfCoreStore.createAppInstance(
        multisigAddress,
        appInstance,
        updatedFreeBalance,
        updatedFreeBalanceCommitment,
        conditionalTx,
      );
      const app = await cfCoreStore.getAppInstance(appInstance.identityHash);
      expect(app).toMatchObject(appInstance);

      const updatedFreeBalanceCommitmentFromStore = await cfCoreStore.getSetStateCommitment(
        channelJson.freeBalanceAppInstance.identityHash,
      );
      expect(updatedFreeBalanceCommitmentFromStore).toMatchObject(updatedFreeBalanceCommitment);

      const conditionalTxFromStore = await cfCoreStore.getConditionalTransactionCommitment(
        appInstance.identityHash,
      );
      expect(conditionalTxFromStore).toMatchObject(conditionalTx);

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
      const setStateCommitment = createSetStateCommitmentJSON();
      await cfCoreStore.createAppProposal(
        multisigAddress,
        appProposal,
        APP_SEQ_NO,
        setStateCommitment,
      );

      const userParticipantAddr = userIdentifier;
      const nodeParticipantAddr = configService.getPublicIdentifier();

      const updatedFreeBalanceCommitment = createSetStateCommitmentJSON();
      const conditionalTx = createConditionalTransactionCommitmentJSON();
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
        updatedFreeBalanceCommitment,
        conditionalTx,
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
        versionNumber: 100,
      });
      await cfCoreStore.updateAppInstance(multisigAddress, updated, updatedSetStateCommitment);
      const app = await cfCoreStore.getAppInstance(appInstance.identityHash);
      expect(app).toMatchObject(updated);

      const conditionalTxFromStore = await cfCoreStore.getConditionalTransactionCommitment(
        appInstance.identityHash,
      );
      expect(conditionalTxFromStore).toMatchObject(conditionalTx);
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
      const updatedFreeBalanceCommitment = createSetStateCommitmentJSON({
        appIdentityHash: channelJson.freeBalanceAppInstance.identityHash,
        versionNumber: 1337,
      });
      await cfCoreStore.removeAppInstance(
        multisigAddress,
        appInstance.identityHash,
        updatedFreeBalance,
        updatedFreeBalanceCommitment,
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

      const updatedFreeBalanceCommitmentFromStore = await cfCoreStore.getSetStateCommitment(
        channelJson.freeBalanceAppInstance.identityHash,
      );
      expect(updatedFreeBalanceCommitmentFromStore).toMatchObject(updatedFreeBalanceCommitment);
    });
  });
});
