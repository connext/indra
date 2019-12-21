import * as connext from "@connext/client";
import { ClientOptions, IConnextClient } from "@connext/types";
import { INestApplication, INestMicroservice } from "@nestjs/common";
import { Transport } from "@nestjs/microservices";
import { Test } from "@nestjs/testing";
import { getConnectionToken } from "@nestjs/typeorm";
import { Connection } from "typeorm";

import { AppModule } from "../../../app.module";
import { ConfigService } from "../../../config/config.service";
import { clearDb } from "../../db";
import { deployContracts } from "../../deployContracts";
import { MemoryStoreServiceFactory } from "../../store";

describe("Deposits", () => {
  let app: INestApplication;
  let micro: INestMicroservice;

  let clientA: IConnextClient;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
    const connection = app.get<Connection>(getConnectionToken());
    await clearDb(connection);

    await app.init();

    const config = app.get(ConfigService);
    const messagingUrl = config.getMessagingConfig().messagingUrl;
    micro = module.createNestMicroservice({
      options: {
        servers: typeof messagingUrl === "string" ? [messagingUrl] : messagingUrl,
      },
      transport: Transport.NATS,
    });
    await micro.init();

    const wallet = config.getEthWallet();
    const mnemonic = config.getMnemonic();
    await deployContracts(wallet, mnemonic);
  }, 90_000);

  test(`should deposit ETH in the happy case.`, async () => {
    const config = app.get(ConfigService);

    const messagingUrl = config.getMessagingConfig().messagingUrl;
    // client setup
    const storeServiceFactory = new MemoryStoreServiceFactory();

    const nodeUrl = typeof messagingUrl === "string" ? messagingUrl : messagingUrl[0];

    // client A
    const clientAStore = storeServiceFactory.createStoreService();
    const clientAOpts: ClientOptions = {
      ethProviderUrl: config.getEthRpcUrl(),
      logLevel: 4,
      mnemonic:
        "humble sense shrug young vehicle assault destroy cook property average silent travel",
      nodeUrl,
      store: clientAStore,
    };
    clientA = await connext.connect(clientAOpts);
    await clientA.isAvailable();

    console.log("clientA: ", clientA);
    // console.log('clientA.publicIdentifier: ', clientA.publicIdentifier);
    expect(clientA.freeBalanceAddress).toBeTruthy();
  }, 180_000);

  afterAll(async () => {
    await app.close();
  });
});
