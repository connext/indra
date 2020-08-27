import { connect } from "@connext/client";
import { getMemoryStore } from "@connext/store";
import { IConnextClient, WatcherEvents } from "@connext/types";
import {
  ColorfulLogger,
  delay,
  getRandomChannelSigner,
  logTime,
  stringify,
} from "@connext/utils";
import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { Provider } from "@ethersproject/providers";
import { constants, utils, Wallet } from "ethers";

import { AppModule } from "../../app.module";
import { ConfigService } from "../../config/config.service";
import { ConfigService } from "../../config/config.service";

import { env, ethProviderUrl, expect, MockConfigService } from "../utils";

const { AddressZero } = constants;
const { parseEther } = utils;

describe.skip("Challenges", () => {
  const log = new ColorfulLogger("Challenges", 3, true, "Test");

  let app: INestApplication;
  let configService: ConfigService;
  let clientA: IConnextClient;
  let clientB: IConnextClient;
  let chainId: number;
  let ethProvider: Provider;
  let sugarDaddy: Wallet;
  let start: number;

  beforeEach(async () => {
    start = Date.now();
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
    sugarDaddy = Wallet.fromMnemonic(env.mnemonic!).connect(ethProvider);
    log.info(`node: ${await configService.getSignerAddress()}`);
    log.info(`ethProviderUrl: ${ethProviderUrl}`);

    let tx;
    clientA = await connect({
      store: getMemoryStore(),
      signer: getRandomChannelSigner(ethProvider),
      ethProviderUrl,
      messagingUrl: env.messagingUrl,
      nodeUrl: env.nodeUrl,
      loggerService: new ColorfulLogger("", env.logLevel, true, "A"),
    });
    log.debug(`clientA: ${clientA.signerAddress} aka ${clientA.publicIdentifier}`);
    expect(clientA.signerAddress).to.be.a("string");
    tx = await sugarDaddy.sendTransaction({ to: clientA.signerAddress, value: parseEther("0.1") });
    await ethProvider.waitForTransaction(tx.hash);

    clientB = await connect({
      store: getMemoryStore({ prefix: "Babe" }),
      signer: getRandomChannelSigner(ethProvider),
      ethProviderUrl,
      messagingUrl: env.messagingUrl,
      nodeUrl: env.nodeUrl,
      loggerService: new ColorfulLogger("", env.logLevel, true, "B"),
    });
    log.debug(`clientB: ${clientB.signerAddress} aka ${clientB.publicIdentifier}`);
    expect(clientB.signerAddress).to.be.a("string");
    tx = await sugarDaddy.sendTransaction({ to: clientB.signerAddress, value: parseEther("0.1") });
    await ethProvider.waitForTransaction(tx.hash);

    const depositA = await clientA.deposit({ assetId: AddressZero, amount: parseEther("0.03") });
    const depositB = await clientB.deposit({ assetId: AddressZero, amount: parseEther("0.03") });
    await depositA.completed();
    await depositB.completed();

    const logEvent = (name: WatcherEvents) => {
      clientA.watcher.on(name, (data) => {
        log.info(`[A] New Event: ${name} w data: ${stringify(data)}`);
      });
      clientB.watcher.on(name, (data) => {
        log.info(`[B] New Event: ${name} w data: ${stringify(data)}`);
      });
    };
    logEvent(WatcherEvents.CHALLENGE_UPDATED_EVENT);
    logEvent(WatcherEvents.STATE_PROGRESSED_EVENT);
    logEvent(WatcherEvents.CHALLENGE_PROGRESSED_EVENT);
    logEvent(WatcherEvents.CHALLENGE_PROGRESSION_FAILED_EVENT);
    logEvent(WatcherEvents.CHALLENGE_OUTCOME_SET_EVENT);
    logEvent(WatcherEvents.CHALLENGE_OUTCOME_FAILED_EVENT);
    logEvent(WatcherEvents.CHALLENGE_COMPLETED_EVENT);
    logEvent(WatcherEvents.CHALLENGE_COMPLETION_FAILED_EVENT);
    logEvent(WatcherEvents.CHALLENGE_CANCELLED_EVENT);
    logEvent(WatcherEvents.CHALLENGE_CANCELLATION_FAILED_EVENT);

    logTime(log, start, "Done setting up test env");
  });

  afterEach(async () => {
    try {
      await clientA?.off();
      await clientB?.off();
      await app.close();
      await delay(1000);
      log.info(`Application was shutdown successfully`);
    } catch (e) {
      log.warn(`Application was shutdown unsuccessfully: ${e.message}`);
    }
  });

  it("client should be able to initiate a dispute", async () => {
    const transferRes = await clientA.transfer({
      amount: parseEther("0.02"),
      assetId: AddressZero,
      recipient: clientB.publicIdentifier,
    });
    log.info(`transferRes: ${stringify(transferRes)}`);
    const { appInstance: app } = (await clientA.getAppInstance(transferRes.appIdentityHash)) || {};
    const complete = clientA.watcher.waitFor(WatcherEvents.CHALLENGE_COMPLETED_EVENT);
    const challengeRes = await clientA.initiateChallenge({
      appIdentityHash: app.identityHash,
    });
    expect(challengeRes.appChallenge.hash).to.be.ok;
    expect(challengeRes.freeBalanceChallenge.hash).to.be.ok;
    log.info(`challengeRes: ${stringify(challengeRes)}`);
    log.info(`Waiting for ${WatcherEvents.CHALLENGE_COMPLETED_EVENT} event`);
    await complete;
  });

  it("node and client should be able to cooperatively cancel a dispute", async () => {
    const transferRes = await clientA.transfer({
      amount: parseEther("0.01"),
      assetId: AddressZero,
      recipient: clientB.publicIdentifier,
    });
    log.info(`transferRes: ${stringify(transferRes)}`);
    const { appInstance: app } = (await clientA.getAppInstance(transferRes.appIdentityHash)) || {};
    const challengeRes = await clientA.initiateChallenge({
      appIdentityHash: app.identityHash,
    });
    log.info(`challengeRes: ${stringify(challengeRes)}`);
    expect(challengeRes.appChallenge.hash).to.be.a("string");
    expect(challengeRes.freeBalanceChallenge.hash).to.be.a("string");
    log.info(`cancelling..`);
    const cancelRes = await clientA.cancelChallenge({
      appIdentityHash: app.identityHash,
    });
    log.info(`cancelRes: ${stringify(cancelRes)}`);
  });

  it("channel should not operate when it is in dispute (client initiated)", async () => {
    const transferRes = await clientA.transfer({
      amount: parseEther("0.01"),
      assetId: AddressZero,
      recipient: clientB.publicIdentifier,
    });
    log.info(`transferRes: ${stringify(transferRes)}`);
    const { appInstance: app } = (await clientA.getAppInstance(transferRes.appIdentityHash)) || {};
    const challengeRes = await clientA.initiateChallenge({
      appIdentityHash: app.identityHash,
    });
    expect(challengeRes.appChallenge.hash).to.be.a("string");
    expect(challengeRes.freeBalanceChallenge.hash).to.be.a("string");
    log.info(`freeBalanceChallenge: ${stringify(challengeRes.freeBalanceChallenge)}`);

    const channel = await clientA.store.getStateChannel(clientA.multisigAddress);
    const freeBalanceId = channel.freeBalanceAppInstance.identityHash;

    const challenges = await clientA.store.getActiveChallenges();
    log.info(`There are ${challenges.length} active challenges `);
    log.info(`freebalance id: ${freeBalanceId} | app id ${app.identityHash}`);

    const freeBalanceChallenge = await clientA.store.getAppChallenge(freeBalanceId);
    log.info(`Free Balance challenge 1: ${
      stringify(challenges.find(c => c.identityHash === freeBalanceId ))
    }`);
    log.info(`Free Balance challenge 2: ${stringify(freeBalanceChallenge)}`);
    expect(freeBalanceChallenge).to.be.ok;

    return expect(clientA.deposit({ assetId: AddressZero, amount: parseEther("0.02") })).to.be.rejectedWith("dispute");
  });
});

