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
import { mkXpub, mkAddress } from "../test/utils";
import { createStateChannelJSON } from "../test/cfCore";
import { ConfigService } from "../config/config.service";

const createTestChannel = async (
  cfCoreStore: CFCoreStore,
  nodePublicIdentifier: string,
  userPublicIdentifier: string = mkXpub("b"),
  multisigAddress: string = mkAddress("0xa"),
) => {
  await cfCoreStore.saveSetupCommitment(multisigAddress, {
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

  it.only("should create a state channel", async () => {
    const { multisigAddress, channelJson } = await createTestChannel(
      cfCoreStore,
      configService.getPublicIdentifier(),
    );

    let channel = await cfCoreStore.getStateChannel(multisigAddress);

    // const appProposal = createAppInstanceProposal({ identityHash: mkHash("0xa") });
    // await cfCoreStore.saveAppProposal(multisigAddress, appProposal, 1);
    console.log('channel: ', channel);

    expect(channel).toMatchObject({
      ...channelJson,
      userNeuteredExtendedKeys: channelJson.userNeuteredExtendedKeys.sort(),
    });
  });
});
