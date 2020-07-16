import { Test } from "@nestjs/testing";
import { TypeOrmModule } from "@nestjs/typeorm";
import { getRandomBytes32 } from "@connext/utils";
import { BigNumber } from "ethers";

import { CFCoreRecordRepository } from "../cfCore/cfCore.repository";
import { ChannelRepository } from "../channel/channel.repository";
import { ConfigModule } from "../config/config.module";
import { DatabaseModule } from "../database/database.module";
import { LoggerModule } from "../logger/logger.module";
import { CFCoreStore } from "../cfCore/cfCore.store";
import { ConfigService } from "../config/config.service";
import {
  createTestChannel,
  expect,
  getTestTransactionRequest,
  getTestTransactionResponse,
} from "../test/utils";
import { AppInstanceRepository } from "../appInstance/appInstance.repository";
import { ConditionalTransactionCommitmentRepository } from "../conditionalCommitment/conditionalCommitment.repository";
import { SetStateCommitmentRepository } from "../setStateCommitment/setStateCommitment.repository";
import { WithdrawCommitmentRepository } from "../withdrawCommitment/withdrawCommitment.repository";
import { SetupCommitmentRepository } from "../setupCommitment/setupCommitment.repository";
import { ChallengeRepository, ProcessedBlockRepository } from "../challenge/challenge.repository";
import { CacheModule } from "../caching/cache.module";

import { OnchainTransactionRepository } from "./onchainTransaction.repository";
import { TransactionReason } from "./onchainTransaction.entity";
import { KNOWN_ERRORS } from "./onchainTransaction.service";
import { getConnection } from "typeorm";

describe("OnchainTransactionRepository", () => {
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
          AppInstanceRepository,
          ConditionalTransactionCommitmentRepository,
          SetStateCommitmentRepository,
          WithdrawCommitmentRepository,
          SetupCommitmentRepository,
          ChallengeRepository,
          ProcessedBlockRepository,
          OnchainTransactionRepository,
        ]),
        CacheModule,
      ],
    }).compile();

    onchainTxRepository = module.get<OnchainTransactionRepository>(OnchainTransactionRepository);
    cfCoreStore = module.get<CFCoreStore>(CFCoreStore);
    configService = module.get<ConfigService>(ConfigService);
    channelRepository = module.get<ChannelRepository>(ChannelRepository);
  });

  afterEach(async () => {
    await getConnection().dropDatabase();
    await getConnection().close();
  });

  it("should get failed transactions", async () => {
    const { multisigAddress } = await createTestChannel(
      cfCoreStore,
      configService.getPublicIdentifier(),
    );

    const channel = await channelRepository.findByMultisigAddressOrThrow(multisigAddress);

    let testTx = getTestTransactionRequest();
    let txHash = getRandomBytes32();
    let response = getTestTransactionResponse({
      data: testTx.data as string,
      to: testTx.to,
      value: testTx.value as BigNumber,
      hash: txHash,
    });
    await onchainTxRepository.addResponse(response, TransactionReason.COLLATERALIZATION, channel);
    await onchainTxRepository.addResponse(response, TransactionReason.COLLATERALIZATION, channel);
    await onchainTxRepository.addResponse(response, TransactionReason.COLLATERALIZATION, channel);
    await onchainTxRepository.markFailed(response, { 1: "hello", 2: "world" });

    testTx = getTestTransactionRequest();
    txHash = getRandomBytes32();
    response = getTestTransactionResponse({
      data: testTx.data as string,
      to: testTx.to,
      value: testTx.value as BigNumber,
      hash: txHash,
    });
    await onchainTxRepository.addResponse(response, TransactionReason.COLLATERALIZATION, channel);
    await onchainTxRepository.addResponse(response, TransactionReason.COLLATERALIZATION, channel);
    await onchainTxRepository.addResponse(response, TransactionReason.COLLATERALIZATION, channel);
    await onchainTxRepository.markFailed(response, { 1: "hello", 2: "world", 3: KNOWN_ERRORS[0] });

    testTx = getTestTransactionRequest();
    txHash = getRandomBytes32();
    response = getTestTransactionResponse({
      data: testTx.data as string,
      to: testTx.to,
      value: testTx.value as BigNumber,
      hash: txHash,
    });
    await onchainTxRepository.addResponse(response, TransactionReason.COLLATERALIZATION, channel);
    await onchainTxRepository.addResponse(response, TransactionReason.COLLATERALIZATION, channel);
    await onchainTxRepository.addResponse(response, TransactionReason.COLLATERALIZATION, channel);
    await onchainTxRepository.markFailed(response, { 1: KNOWN_ERRORS[1] });

    const transactions = await onchainTxRepository.findFailedTransactions(KNOWN_ERRORS);

    expect(transactions.length).to.eq(2);
  });
});
