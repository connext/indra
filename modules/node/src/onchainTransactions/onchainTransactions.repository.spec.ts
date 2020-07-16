import { Test } from "@nestjs/testing";
import { TypeOrmModule } from "@nestjs/typeorm";

import { getTestTransactionRequest, getTestTransactionResponse } from "../test/utils/eth";

import { CFCoreRecordRepository } from "../cfCore/cfCore.repository";
import { ChannelRepository } from "../channel/channel.repository";
import { ConfigModule } from "../config/config.module";
import { DatabaseModule } from "../database/database.module";
import { LoggerModule } from "../logger/logger.module";
import { CFCoreStore } from "../cfCore/cfCore.store";

import { OnchainTransactionRepository } from "./onchainTransaction.repository";
import { TransactionReason } from "./onchainTransaction.entity";
import { ConfigService } from "../config/config.service";
import { createTestChannel } from "../test/utils";
import { BigNumber } from "ethers";
import { getRandomBytes32 } from "@connext/utils";

describe("MemoLock", () => {
  let onchainTxRepository: OnchainTransactionRepository;
  let cfCoreStore: CFCoreStore;
  let configService: ConfigService;
  let channelRepository: ChannelRepository;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [CFCoreStore],
      imports: [
        ConfigModule,
        DatabaseModule,
        LoggerModule,
        TypeOrmModule.forFeature([
          CFCoreRecordRepository,
          ChannelRepository,
          OnchainTransactionRepository,
        ]),
      ],
    }).compile();

    onchainTxRepository = module.get<OnchainTransactionRepository>(OnchainTransactionRepository);
    cfCoreStore = module.get<CFCoreStore>(CFCoreStore);
    configService = module.get<ConfigService>(ConfigService);
    channelRepository = module.get<ChannelRepository>(ChannelRepository);
  });

  it.only("should get failed transactions", async () => {
    const { multisigAddress } = await createTestChannel(
      cfCoreStore,
      configService.getPublicIdentifier(),
    );

    const channel = await channelRepository.findByMultisigAddressOrThrow(multisigAddress);

    const testTx = getTestTransactionRequest();
    await onchainTxRepository.addRequest(testTx, TransactionReason.COLLATERALIZATION, channel);

    const txHash = getRandomBytes32();
    await onchainTxRepository.addResponse(
      getTestTransactionResponse({
        data: testTx.data as string,
        to: testTx.to,
        value: testTx.value as BigNumber,
        hash: txHash,
      }),
    );

    const otx = onchainTxRepository.findByHash(txHash);
  });
});
