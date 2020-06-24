import { connect } from "@connext/client";
import {
  ColorfulLogger,
  getRandomPrivateKey,
  logTime,
  stringify,
  getRandomChannelSigner,
} from "@connext/utils";
import { INestApplication } from "@nestjs/common";
import { getMemoryStore } from "@connext/store";
import { Test, TestingModule } from "@nestjs/testing";
import { IConnextClient } from "@connext/types";
import { Wallet, constants, utils } from "ethers";

import { AppModule } from "../../app.module";
import { ConfigService } from "../../config/config.service";

import { env, expect, MockConfigService } from "../utils";

const { AddressZero } = constants;
const { parseEther } = utils;

describe("Happy path", () => {
  const log = new ColorfulLogger("TestStartup", env.logLevel, true, "T");

  let app: INestApplication;
  let configService: ConfigService;
  let clientA: IConnextClient;
  let clientB: IConnextClient;

  before(async () => {
    const start = Date.now();
    let tx;
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(ConfigService)
      .useClass(MockConfigService)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    configService = moduleFixture.get<ConfigService>(ConfigService);
    await app.listen(configService.getPort());

    const ethProvider = configService.getEthProvider();
    const sugarDaddy = Wallet.fromMnemonic(process.env.INDRA_ETH_MNEMONIC!).connect(ethProvider);
    log.info(`node: ${await configService.getSignerAddress()}`);
    const nodeUrl = "http://localhost:8080";

    clientA = await connect({
      store: getMemoryStore(),
      signer: getRandomChannelSigner(ethProvider),
      ethProviderUrl: configService.getEthRpcUrl(),
      messagingUrl: configService.getMessagingConfig().messagingUrl[0],
      nodeUrl,
      loggerService: new ColorfulLogger("", env.logLevel, true, "A"),
    });
    log.info(`clientA: ${clientA.signerAddress}`);
    expect(clientA.signerAddress).to.be.a("string");
    tx = await sugarDaddy.sendTransaction({ to: clientA.signerAddress, value: parseEther("0.1") });
    await ethProvider.waitForTransaction(tx.hash);

    clientB = await connect({
      store: getMemoryStore(),
      signer: getRandomPrivateKey(),
      ethProviderUrl: configService.getEthRpcUrl(),
      messagingUrl: configService.getMessagingConfig().messagingUrl[0],
      nodeUrl,
      loggerService: new ColorfulLogger("", env.logLevel, true, "B"),
    });
    log.info(`clientB: ${clientB.signerAddress}`);
    expect(clientB.signerAddress).to.be.a("string");
    tx = await sugarDaddy.sendTransaction({ to: clientB.signerAddress, value: parseEther("0.1") });
    await ethProvider.waitForTransaction(tx.hash);

    logTime(log, start, "Done setting up test env");
  });

  after(async () => {
    try {
      await app.close();
      log.info(`Application was shutdown successfully`);
    } catch (e) {
      log.warn(`Application was shutdown unsuccessfully: ${e.message}`);
    }
  });

  it("should let a client deposit, transfer, and withdraw ", async () => {
    const depositRes = await clientA.deposit({
      assetId: AddressZero,
      amount: parseEther("0.03"),
    });
    log.info(`depositRes: ${stringify(depositRes)}`);
    const transferRes = await clientA.transfer({
      amount: parseEther("0.02"),
      assetId: AddressZero,
      recipient: clientB.publicIdentifier,
    });
    log.info(`transferRes: ${stringify(transferRes)}`);
    // TODO: make this work w clientB withdrawing instead
    const withdrawRes = await clientA.withdraw({
      assetId: AddressZero,
      amount: parseEther("0.01"),
    });
    log.info(`withdrawRes: ${stringify(withdrawRes)}`);
  });
});
