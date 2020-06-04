import { connect } from "@connext/client";
import { addressBook } from "@connext/contracts";
import { ChannelSigner, ColorfulLogger, getRandomPrivateKey, stringify } from "@connext/utils";
import { INestApplication } from "@nestjs/common";
import { getMemoryStore } from "@connext/store";
import { Test, TestingModule } from "@nestjs/testing";
import { IConnextClient } from "@connext/types";
import { Wallet } from "ethers";
import { AddressZero } from "ethers/constants";
import { parseEther } from "ethers/utils";

import { AppModule } from "../../app.module";
import { ChannelRepository } from "../../channel/channel.repository";
import { ConfigService } from "../../config/config.service";

import { expect } from "../utils";

const env = {
  logLevel: parseInt(process.env.LOG_LEVEL || "0", 10),
  indraLogLevel: parseInt(process.env.INDRA_LOG_LEVEL || "0", 10),
};

class MockConfigService extends ConfigService {
  signer = new ChannelSigner(getRandomPrivateKey(), this.getEthRpcUrl());

  getLogLevel(): number {
    return env.indraLogLevel;
  }

  getSigner() {
    return this.signer;
  }

  async getSignerAddress() {
    return this.getSigner().address;
  }

  getPublicIdentifier() {
    return this.getSigner().publicIdentifier;
  }

  getSupportedTokens(): string[] {
    return [AddressZero];
  }

  getSupportedTokenAddresses(): string[] {
    return this.getSupportedTokens();
  }

  async getContractAddresses(chainId: string = "4447"): Promise<ContractAddresses> {
    const contractAddresses = {};
    Object.entries(addressBook[chainId]).forEach(([key, entry]) => {
      contractAddresses[key] = entry.address;
    });
    return contractAddresses;
  }
}

describe("Startup", () => {
  const log = new ColorfulLogger("TestStartup", env.logLevel, true, "T");
  let app: INestApplication;
  let configService: ConfigService;
  let clientA: IConnextClient;
  let clientB: IConnextClient;
  let channelRepo: ChannelRepository;

  before(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(ConfigService)
      .useClass(MockConfigService)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    configService = moduleFixture.get<ConfigService>(ConfigService);
    channelRepo = moduleFixture.get<ChannelRepository>(ChannelRepository);
    await app.listen(configService.getPort());

    const nodeUrl = "http://localhost:8080";

    const channels = await channelRepo.findAll();
    log.info(`config loglevel: ${configService.getLogLevel()}`);
    log.debug(`channels: ${stringify(channels)}`);

    const storeA = getMemoryStore();
    const pkA = getRandomPrivateKey();
    clientA = await connect({
      store: storeA,
      signer: pkA,
      ethProviderUrl: configService.getEthRpcUrl(),
      messagingUrl: configService.getMessagingConfig().messagingUrl[0],
      nodeUrl,
      loggerService: log,
    });
    log.debug(`clientA.signerAddress: ${clientA.signerAddress}`);
    log.debug(`clientA.publicIdentifier: ${clientA.publicIdentifier}`);
    expect(clientA.signerAddress).to.be.a("string");

    const realWallet = Wallet.fromMnemonic(process.env.INDRA_ETH_MNEMONIC).connect(
      configService.getEthProvider(),
    );
    await realWallet.sendTransaction({ to: clientA.signerAddress, value: parseEther("0.1") });

    const storeB = getMemoryStore();
    const pkB = getRandomPrivateKey();
    log.debug(`pkB: ${pkB}`);
    clientB = await connect("localhost", {
      store: storeB,
      signer: pkB,
      ethProviderUrl: configService.getEthRpcUrl(),
      messagingUrl: configService.getMessagingConfig().messagingUrl[0],
      nodeUrl,
      loggerService: log,
    });
    await realWallet.sendTransaction({ to: clientB.signerAddress, value: parseEther("0.1") });
    log.debug(`clientB.signerAddress: ${clientB.signerAddress}`);
    log.debug(`clientB.publicIdentifier: ${clientB.publicIdentifier}`);
    expect(clientB.signerAddress).to.be.a("string");
  });

  it("should properly handle a client deposit + transfer", async () => {
    log.warn(`ClientA config: ${stringify(clientA.config)}`);
    await clientA.deposit({ assetId: AddressZero, amount: parseEther("0.01") });
    const transferRes = await clientA.transfer({
      amount: parseEther("0.001"),
      assetId: AddressZero,
      recipient: clientB.publicIdentifier,
    });
    log.debug(`transferRes: ${transferRes}`);
    log.debug(`getSignerAddress: ${await configService.getSignerAddress()}`);
  });

  it("should throw a descriptive error if node is out of money", async () => {
    await clientA.deposit({ assetId: AddressZero, amount: parseEther("0.01") });
    expect(
      clientA.withdraw({ assetId: AddressZero, amount: parseEther("0.01") }),
    ).to.be.rejectedWith("insufficient funds");
  });

});
