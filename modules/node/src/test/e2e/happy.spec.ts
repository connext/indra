import { connect } from "@connext/client";
import {
  ColorfulLogger,
  delay,
  getRandomBytes32,
  getRandomChannelSigner,
  getRandomPrivateKey,
  logTime,
  stringify,
} from "@connext/utils";
import { INestApplication } from "@nestjs/common";
import { getMemoryStore } from "@connext/store";
import { Test, TestingModule } from "@nestjs/testing";
import { IConnextClient } from "@connext/types";
import { Provider, TransactionResponse } from "@ethersproject/providers";
import { Wallet, constants, utils } from "ethers";

import { AppModule } from "../../app.module";
import { ConfigService } from "../../config/config.service";

import { env, ethProviderUrl, expect, MockConfigService } from "../utils";

const { AddressZero } = constants;
const { parseEther } = utils;

describe("Mostly happy paths", () => {
  const log = new ColorfulLogger("MostlyHappy", env.logLevel, true, "Test");

  let app: INestApplication;
  let configService: ConfigService;
  let clientA: IConnextClient;
  let clientB: IConnextClient;
  let chainId: number;
  let ethProvider: Provider;

  beforeEach(async () => {
    const start = Date.now();
    let tx: TransactionResponse;
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

    chainId = configService.getSupportedChains()[0];
    ethProvider = configService.getEthProvider(chainId);
    const sugarDaddy = Wallet.fromMnemonic(env.mnemonic!).connect(ethProvider);
    log.info(`node: ${await configService.getSignerAddress()}`);
    log.info(`ethProviderUrl: ${ethProviderUrl}`);

    clientA = await connect({
      store: getMemoryStore(),
      signer: getRandomChannelSigner(ethProvider),
      ethProviderUrl,
      messagingUrl: env.messagingUrl,
      nodeUrl: env.nodeUrl,
      loggerService: new ColorfulLogger("", env.logLevel, true, "A"),
    });
    log.info(`clientA: ${clientA.signerAddress}`);
    expect(clientA.signerAddress).to.be.a("string");
    tx = await sugarDaddy.sendTransaction({ to: clientA.signerAddress, value: parseEther("0.1") });
    await ethProvider.waitForTransaction(tx.hash);

    clientB = await connect({
      store: getMemoryStore(),
      signer: getRandomPrivateKey(),
      ethProviderUrl,
      messagingUrl: env.messagingUrl,
      nodeUrl: env.nodeUrl,
      loggerService: new ColorfulLogger("", env.logLevel, true, "B"),
    });
    log.info(`clientB: ${clientB.signerAddress}`);
    expect(clientB.signerAddress).to.be.a("string");
    tx = await sugarDaddy.sendTransaction({ to: clientB.signerAddress, value: parseEther("0.1") });
    await ethProvider.waitForTransaction(tx.hash);

    logTime(log, start, "Done setting up test env");
  });

  afterEach(async () => {
    try {
      await clientA.off();
      await clientB.off();
      await app.close();
      await delay(1000);
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
    await depositRes.completed();
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
    await ethProvider.waitForTransaction(withdrawRes.transaction.hash);
    const receipt = await ethProvider.getTransactionReceipt(withdrawRes.transaction.hash);
    expect(receipt.status).to.equal(1);
  });

  it("should fail if client tries to re-use the same payment Id", async () => {
    const depositRes = await clientA.deposit({
      assetId: AddressZero,
      amount: parseEther("0.03"),
    });
    log.info(`Deposit was successful: ${stringify(depositRes)}`);
    await depositRes.completed();
    const paymentId = getRandomBytes32();
    log.info(`Sending first transfer with paymentId ${paymentId}`);
    const transferRes = await clientA.transfer({
      amount: parseEther("0.01"),
      assetId: AddressZero,
      paymentId,
      recipient: clientB.publicIdentifier,
    });
    log.info(`First transfer was successful: ${stringify(transferRes)}`);
    expect(
      clientA.transfer({
        amount: parseEther("0.01"),
        assetId: AddressZero,
        paymentId,
        recipient: clientB.publicIdentifier,
      }),
    ).to.be.rejectedWith(/Duplicate payment id/);
  });
});
