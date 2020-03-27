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
import { mkAddress } from "../test/utils";
import { createStateChannelJSON, generateRandomXpub, createAppInstanceProposal } from "../test/cfCore";
import { ConfigService } from "../config/config.service";
import { sortAddresses } from "../util";

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

  it.only("should create an app proposal", async () => {
    const { multisigAddress } = await createTestChannel(
      cfCoreStore,
      configService.getPublicIdentifier(),
    );

    const appProposal = createAppInstanceProposal();
    await cfCoreStore.createAppProposal(multisigAddress, appProposal, 2);

    const received = await cfCoreStore.getAppProposal(appProposal.identityHash);
    expect(received).toMatchObject(appProposal);
  });
});
