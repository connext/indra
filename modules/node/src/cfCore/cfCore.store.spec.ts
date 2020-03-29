import { Test } from "@nestjs/testing";
import { TypeOrmModule } from "@nestjs/typeorm";

import { AppInstanceRepository } from "../appInstance/appInstance.repository";
import { AppRegistryRepository } from "../appRegistry/appRegistry.repository";
import { ChannelRepository } from "../channel/channel.repository";
import { SetStateCommitmentRepository } from "../setStateCommitment/setStateCommitment.repository";
import { WithdrawCommitmentRepository } from "../withdrawCommitment/withdrawCommitment.repository";
import { SetupCommitmentRepository } from "../setupCommitment/setupCommitment.repository";
import { ConditionalTransactionCommitmentRepository } from "../conditionalCommitment/conditionalCommitment.repository";
import { ConfigModule } from "../config/config.module";
import { DatabaseModule } from "../database/database.module";

import { CFCoreRecordRepository } from "./cfCore.repository";
import { CFCoreStore } from "./cfCore.store";
import { AddressZero } from "ethers/constants";
import { mkAddress, mkHash } from "../test/utils";
import {
  createStateChannelJSON,
  generateRandomXpub,
  createAppInstanceProposal,
  createAppInstanceJson,
} from "../test/cfCore";
import { ConfigService } from "../config/config.service";
import { sortAddresses, AppInstanceJson, xkeyKthAddress } from "../util";

const createTestChannel = async (
  cfCoreStore: CFCoreStore,
  nodePublicIdentifier: string,
  userPublicIdentifier: string = generateRandomXpub(),
  multisigAddress: string = mkAddress("0xa"),
) => {
  await cfCoreStore.createSetupCommitment(multisigAddress, {
    data: "",
    to: AddressZero,
    value: 0,
  });

  const channelJson = createStateChannelJSON({
    multisigAddress,
    userNeuteredExtendedKeys: [nodePublicIdentifier, userPublicIdentifier],
  });
  await cfCoreStore.createStateChannel(channelJson);

  return { multisigAddress, userPublicIdentifier, channelJson };
};

describe("CFCoreStore", () => {
  let cfCoreStore: CFCoreStore;
  let configService: ConfigService;

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
  });

  it("should create a state channel", async () => {
    const { multisigAddress, channelJson } = await createTestChannel(
      cfCoreStore,
      configService.getPublicIdentifier(),
    );

    let channel = await cfCoreStore.getStateChannel(multisigAddress);

    expect(channel).toMatchObject({
      ...channelJson,
      userNeuteredExtendedKeys: channelJson.userNeuteredExtendedKeys.sort(),
      freeBalanceAppInstance: {
        ...channelJson.freeBalanceAppInstance,
        participants: sortAddresses(channelJson.freeBalanceAppInstance.participants),
      },
    });
  });

  it("should create an app proposal", async () => {
    const { multisigAddress } = await createTestChannel(
      cfCoreStore,
      configService.getPublicIdentifier(),
    );

    const appProposal = createAppInstanceProposal();
    await cfCoreStore.createAppProposal(multisigAddress, appProposal, 2);

    const received = await cfCoreStore.getAppProposal(appProposal.identityHash);
    expect(received).toMatchObject(appProposal);
  });

  it("should not create an app instance if there is no app proposal", async () => {
    const { multisigAddress, channelJson } = await createTestChannel(
      cfCoreStore,
      configService.getPublicIdentifier(),
    );

    const appInstance = createAppInstanceJson();
    const updatedFreeBalance: AppInstanceJson = {
      ...channelJson.freeBalanceAppInstance,
      latestState: { appState: "updated" },
    };
    expect(
      cfCoreStore.createAppInstance(multisigAddress, appInstance, updatedFreeBalance),
    ).rejects.toThrowError(/Could not find app with identity hash/);
  });

  it("should create app instance", async () => {
    const { multisigAddress, channelJson, userPublicIdentifier } = await createTestChannel(
      cfCoreStore,
      configService.getPublicIdentifier(),
    );

    const appProposal = createAppInstanceProposal(mkHash("0xaaa"));
    await cfCoreStore.createAppProposal(multisigAddress, appProposal, 2);

    const userParticipantAddr = xkeyKthAddress(userPublicIdentifier, appProposal.appSeqNo);
    const nodeParticipantAddr = xkeyKthAddress(
      configService.getPublicIdentifier(),
      appProposal.appSeqNo,
    );

    const appInstance = createAppInstanceJson(mkHash("0xaaa"), {
      multisigAddress,
      participants: sortAddresses([userParticipantAddr, nodeParticipantAddr]),
    });
    const updatedFreeBalance: AppInstanceJson = {
      ...channelJson.freeBalanceAppInstance,
      latestState: { appState: "updated" },
    };
    await cfCoreStore.createAppInstance(multisigAddress, appInstance, updatedFreeBalance);
    const app = await cfCoreStore.getAppInstance(appInstance.identityHash);
    expect(app).toMatchObject(appInstance);
  });

  it.only("should update app instance", async () => {
    const { multisigAddress, channelJson, userPublicIdentifier } = await createTestChannel(
      cfCoreStore,
      configService.getPublicIdentifier(),
    );

    const appProposal = createAppInstanceProposal(mkHash("0xaaa"));
    await cfCoreStore.createAppProposal(multisigAddress, appProposal, 2);

    const userParticipantAddr = xkeyKthAddress(userPublicIdentifier, appProposal.appSeqNo);
    const nodeParticipantAddr = xkeyKthAddress(
      configService.getPublicIdentifier(),
      appProposal.appSeqNo,
    );

    const appInstance = createAppInstanceJson(mkHash("0xaaa"), {
      multisigAddress,
      participants: sortAddresses([userParticipantAddr, nodeParticipantAddr]),
    });
    await cfCoreStore.createAppInstance(
      multisigAddress,
      appInstance,
      channelJson.freeBalanceAppInstance,
    );

    const updated = createAppInstanceJson(appInstance.identityHash, {
      ...appInstance,
      latestState: { updated: "test" },
    });

    await cfCoreStore.updateAppInstance(multisigAddress, updated);
    const app = await cfCoreStore.getAppInstance(appInstance.identityHash);
    expect(app).toMatchObject(updated);
  });
});
