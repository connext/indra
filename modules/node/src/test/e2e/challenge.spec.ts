import { connect } from "@connext/client";
import {
  ColorfulLogger,
  getRandomChannelSigner,
  logTime,
} from "@connext/utils";
import { INestApplication } from "@nestjs/common";
import { getMemoryStore } from "@connext/store";
import { Test, TestingModule } from "@nestjs/testing";
import { IConnextClient } from "@connext/types";
import { Provider } from "@ethersproject/providers";
import { Wallet, utils } from "ethers";

import { AppModule } from "../../app.module";
import { ConfigService } from "../../config/config.service";

import { env, ethProviderUrl, expect, MockConfigService } from "../utils";

const { parseEther } = utils;

describe.skip("Challenges", () => {
  const log = new ColorfulLogger("MostlyHappy", env.logLevel, true, "Test");

  let app: INestApplication;
  let configService: ConfigService;
  let client: IConnextClient;
  let chainId: number;
  let ethProvider: Provider;

  beforeEach(async () => {
    const start = Date.now();
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

    client = await connect({
      store: getMemoryStore(),
      signer: getRandomChannelSigner(ethProvider),
      ethProviderUrl,
      messagingUrl: env.messagingUrl,
      nodeUrl: env.nodeUrl,
      loggerService: new ColorfulLogger("", env.logLevel, true, "A"),
      watcherEnabled: true,
    });
    log.info(`client: ${client.signerAddress}`);
    expect(client.signerAddress).to.be.a("string");
    const tx = await sugarDaddy.sendTransaction({ to: client.signerAddress, value: parseEther("0.1") });
    await ethProvider.waitForTransaction(tx.hash);

    logTime(log, start, "Done setting up test env");
  });

  afterEach(async () => {
    await client.messaging.disconnect();
  });

  it("node should be able to initiate a dispute", async () => {
    // trigger node initiated dispute
    // wait for challenge completion event from watcher
  });

  it("client should be able to initiate a dispute", async () => {
    const { appChallenge, freeBalanceChallenge } = await client.initiateChallenge({
      appIdentityHash: app.identityHash,
    });
    expect(appChallenge.hash).to.be.ok;
    expect(freeBalanceChallenge.hash).to.be.ok;

    // wait for challenge completion event from watcher
  });

  it("node and client should be able to cooperatively cancel a dispute", async () => {
    // begin dispute
    // wait for challenge event from watcher
    // cancel the dispute
  });

  it("channel should not operate when it is in dispute (client initiated)", async () => {
    // begin dispute from client
    // try to deposit (should fail)
  });

  it("channel should not operate when it is in dispute (node initiated)", async () => {
    // begin dispute from node
    // try to deposit from client (should fail)
  });
});

