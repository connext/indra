import { Test, TestingModule } from "@nestjs/testing";
import { connect } from "@connext/client";
import { One, AddressZero } from "ethers/constants";
import { IConnextClient, StoreTypes } from "@connext/types";
import { ConnextStore } from "@connext/store";
import { Wallet } from "ethers";
import { HttpModule, INestApplication } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { mkAddress } from "../test/utils";
import { AppRegistryRepository } from "../appRegistry/appRegistry.repository";
import { AuthModule } from "../auth/auth.module";
import { AppModule } from "../app.module";
import { CFCoreModule } from "../cfCore/cfCore.module";
import { CFCoreRecordRepository } from "../cfCore/cfCore.repository";
import { LoggerModule } from "../logger/logger.module";
import { MessagingModule } from "../messaging/messaging.module";
import { WithdrawModule } from "../withdraw/withdraw.module";
import { DepositModule } from "../deposit/deposit.module";
import { OnchainTransactionRepository } from "../onchainTransactions/onchainTransaction.repository";
import { RebalanceProfileRepository } from "../rebalanceProfile/rebalanceProfile.repository";
import { ConfigModule } from "../config/config.module";
import { ConfigService } from "../config/config.service";
import { SetupCommitmentRepository } from "../setupCommitment/setupCommitment.repository";
import { SetStateCommitmentRepository } from "../setStateCommitment/setStateCommitment.repository";
import { ConditionalTransactionCommitmentRepository } from "../conditionalCommitment/conditionalCommitment.repository";

import { ChannelService } from "./channel.service";
import { ChannelRepository } from "./channel.repository";
import { AuthController } from "../auth/auth.controller";

describe("Channel Service", () => {
  let app: INestApplication;
  let channelService: ChannelService;
  let configService: ConfigService;
  let client: IConnextClient;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    channelService = moduleFixture.get<ChannelService>(ChannelService);
    configService = moduleFixture.get<ConfigService>(ConfigService);
    await app.listen(configService.getPort());

    const nodeUrl = await app.getUrl();

    const store = new ConnextStore(StoreTypes.Memory);
    const wallet = Wallet.createRandom();
    client = await connect("localhost", {
      store,
      signer: wallet.privateKey,
      ethProviderUrl: configService.getEthRpcUrl(),
      messagingUrl: configService.getMessagingConfig().messagingUrl[0],
      nodeUrl,
      logLevel: 1,
    });
    console.log("client.signerAddress: ", client.signerAddress);
    console.log("client.publicIdentifier: ", client.publicIdentifier);
    expect(client.signerAddress).toBeTruthy();
  });

  it("should add deposits to the onchain transaction table", async () => {
    expect(true).toBeTruthy();
  });
});
