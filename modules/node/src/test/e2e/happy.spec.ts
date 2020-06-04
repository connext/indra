import { connect } from "@connext/client";
import { ColorfulLogger, getRandomPrivateKey, logTime, stringify } from "@connext/utils";
import { INestApplication } from "@nestjs/common";
import { getMemoryStore } from "@connext/store";
import { Test, TestingModule } from "@nestjs/testing";
import { IConnextClient } from "@connext/types";
import { providers, Wallet } from "ethers";
import { AddressZero } from "ethers/constants";
import { parseEther } from "ethers/utils";

import { AppModule } from "../../app.module";
import { ConfigService } from "../../config/config.service";

import { env, expect, MockConfigService, nodeSigner } from "../utils";

describe("Happy path", () => {
  const log = new ColorfulLogger("TestStartup", env.logLevel, true, "T");
  let app: INestApplication;
  let configService: ConfigService;
  let clientA: IConnextClient;
  let clientB: IConnextClient;

  before(async () => {
    const start = Date.now();
    let tx;

    tx = await sugarDaddy.sendTransaction({
      to: nodeSigner.address,
      value: parseEther("0.01"),
    });
    await ethProvider.waitForTransaction(tx.hash);

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
    const sugarDaddy = Wallet.fromMnemonic(process.env.INDRA_ETH_MNEMONIC).connect(ethProvider);
    const nodeUrl = "http://localhost:8080";

    tx = await sugarDaddy.sendTransaction({ to: nodeSigner.address, value: parseEther("0.01") });
    await ethProvider.waitForTransaction(tx.hash);

    clientA = await connect({
      store: getMemoryStore(),
      signer: getRandomPrivateKey(),
      ethProviderUrl: configService.getEthRpcUrl(),
      messagingUrl: configService.getMessagingConfig().messagingUrl[0],
      nodeUrl,
      loggerService: new ColorfulLogger("", env.logLevel, true, "A"),
    });
    expect(clientA.signerAddress).to.be.a("string");
    tx = await sugarDaddy.sendTransaction({ to: clientA.signerAddress, value: parseEther("0.1") });
    await ethProvider.waitForTransaction(tx.hash);

    clientB = await connect("localhost", {
      store: getMemoryStore(),
      signer: getRandomPrivateKey(),
      ethProviderUrl: configService.getEthRpcUrl(),
      messagingUrl: configService.getMessagingConfig().messagingUrl[0],
      nodeUrl,
      loggerService: new ColorfulLogger("", env.logLevel, true, "B"),
    });
    expect(clientB.signerAddress).to.be.a("string");
    tx = await sugarDaddy.sendTransaction({ to: clientB.signerAddress, value: parseEther("0.1") });
    await ethProvider.waitForTransaction(tx.hash);

    logTime(log, start, "Done setting up test env");
  });

  it("should throw a descriptive error if node is out of money", async () => {
    const depositRes = await clientA.deposit({
      assetId: AddressZero,
      amount: parseEther("0.01"),
    });
    log.info(`depositRes: ${stringify(depositRes)}`);
    const transferRes = await clientA.transfer({
      amount: parseEther("0.01"),
      assetId: AddressZero,
      recipient: clientB.publicIdentifier,
    });
    log.info(`transferRes: ${stringify(transferRes)}`);
    const withdrawRes = await clientB.withdraw({
      assetId: AddressZero,
      amount: parseEther("0.01"),
    });
    log.info(`withdrawRes: ${stringify(withdrawRes)}`);
  });

});
