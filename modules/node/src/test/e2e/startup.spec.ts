import { connect } from "@connext/client";
import { ChannelSigner, getRandomPrivateKey } from "@connext/utils";
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

class MockConfigService extends ConfigService {
  getLogLevel(): number {
    return 0;
  }

  getSigner() {
    return new ChannelSigner(getRandomPrivateKey(), this.getEthRpcUrl());
  }

  async getSignerAddress() {
    return this.getSigner().address;
  }

  getPublicIdentifier() {
    return this.getSigner().publicIdentifier;
  }
}

describe("Startup", () => {
  let app: INestApplication;
  let configService: ConfigService;
  let clientA: IConnextClient;
  let clientB: IConnextClient;
  let channelRepo: ChannelRepository;

  beforeEach(async () => {
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
    console.log("channels: ", channels);

    const storeA = getMemoryStore();
    const pkA = getRandomPrivateKey();
    console.log("pkA: ", pkA);
    clientA = await connect("localhost", {
      store: storeA,
      signer: pkA,
      ethProviderUrl: configService.getEthRpcUrl(),
      messagingUrl: configService.getMessagingConfig().messagingUrl[0],
      nodeUrl,
      logLevel: 1,
    });
    console.log("clientA.signerAddress: ", clientA.signerAddress);
    console.log("clientA.publicIdentifier: ", clientA.publicIdentifier);
    expect(clientA.signerAddress).toBeTruthy();

    const realWallet = Wallet.fromMnemonic(process.env.INDRA_ETH_MNEMONIC).connect(
      configService.getEthProvider(),
    );
    await realWallet.sendTransaction({ to: clientA.signerAddress, value: parseEther("0.1") });

    const storeB = getMemoryStore();
    const pkB = getRandomPrivateKey();
    console.log("pkB: ", pkB);
    clientB = await connect("localhost", {
      store: storeB,
      signer: pkB,
      ethProviderUrl: configService.getEthRpcUrl(),
      messagingUrl: configService.getMessagingConfig().messagingUrl[0],
      nodeUrl,
      logLevel: 1,
    });
    await realWallet.sendTransaction({ to: clientB.signerAddress, value: parseEther("0.1") });
    console.log("clientB.signerAddress: ", clientB.signerAddress);
    console.log("clientB.publicIdentifier: ", clientB.publicIdentifier);
    expect(clientB.signerAddress).toBeTruthy();
  });

  it("should properly handle a client deposit + transfer", async () => {
    await clientA.deposit({ assetId: AddressZero, amount: parseEther("0.01") });
    const transferRes = await clientA.transfer({
      amount: parseEther("0.001"),
      assetId: AddressZero,
      recipient: clientB.publicIdentifier,
    });
    console.log("transferRes: ", transferRes);
    console.log("getSignerAddress: ", await configService.getSignerAddress());
    console.log("env loglevel", parseInt(process.env.INDRA_LOG_LEVEL, 10));
  });
});
