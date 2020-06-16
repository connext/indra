import { ColorfulLogger, logTime, getRandomChannelSigner, delay } from "@connext/utils";
import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { Wallet, ContractFactory, Contract, providers, BigNumber } from "ethers";
import { connect } from "@connext/client";
import { getMemoryStore } from "@connext/store";

import { AppModule } from "../../app.module";
import { ConfigService } from "../../config/config.service";
import { env, expect, MockConfigService } from "../utils";
import token from "../utils/contractArtifacts/NineDecimalToken.json";
import { ChannelService, RebalanceType } from "../../channel/channel.service";
import { ChannelRepository } from "../../channel/channel.repository";
import { parseUnits } from "ethers/lib/utils";

const nodeUrl = "http://localhost:8080";

// TODO: unskip this. currently fails with DB error
describe.skip("Custom token", () => {
  const log = new ColorfulLogger("TestStartup", env.logLevel, true, "T");

  let app: INestApplication;
  let configService: ConfigService;
  let channelService: ChannelService;
  let tokenContract: Contract;
  let sugarDaddy: Wallet;
  let moduleFixture: TestingModule;
  let nodeSignerAddress: string;

  before(async () => {
    const start = Date.now();

    sugarDaddy = Wallet.fromMnemonic(process.env.INDRA_ETH_MNEMONIC!).connect(
      new providers.JsonRpcProvider(env.ethProviderUrl),
    );

    const factory = new ContractFactory(token.abi, token.bytecode, sugarDaddy);
    tokenContract = await factory.deploy("Test", "TST");
    expect(tokenContract.address).to.be.ok;

    configService = new MockConfigService({
      extraSupportedTokens: [tokenContract.address],
    });

    moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(ConfigService)
      .useValue(configService)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    configService = moduleFixture.get<ConfigService>(ConfigService);
    await app.listen(configService.getPort());
    nodeSignerAddress = await configService.getSignerAddress();
    log.info(`node: ${nodeSignerAddress}`);

    channelService = moduleFixture.get<ChannelService>(ChannelService);

    await tokenContract.mint(nodeSignerAddress, parseUnits("100", 9));

    const supply: BigNumber = await tokenContract.totalSupply();
    expect(supply.eq(100000000000)).to.be.true;

    const balance: BigNumber = await tokenContract.balanceOf(nodeSignerAddress);
    expect(balance.gt(0)).to.be.true;

    const decimals = await tokenContract.functions.decimals();
    expect(decimals.toString()).to.eq("9");
    const supportedTokens = configService.getSupportedTokenAddresses();
    expect(supportedTokens).to.include(tokenContract.address);

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

  it("should collateralize a client with a 9 decimal token", async () => {
    const clientA = await connect({
      store: getMemoryStore(),
      signer: getRandomChannelSigner(configService.getEthProvider()),
      ethProviderUrl: configService.getEthRpcUrl(),
      messagingUrl: configService.getMessagingConfig().messagingUrl[0],
      nodeUrl,
      loggerService: new ColorfulLogger("", 0, true, "A"),
    });
    log.info(`clientA: ${clientA.signerAddress}`);
    expect(clientA.signerAddress).to.be.a("string");

    const channelRepository = moduleFixture.get(ChannelRepository);

    const channel = await channelRepository.findByMultisigAddressOrThrow(clientA.multisigAddress);
    expect(channel.multisigAddress).to.eq(clientA.multisigAddress);

    const tx = await channelService.rebalance(
      channel,
      tokenContract.address,
      RebalanceType.COLLATERALIZE,
    );

    console.log("tx: ", tx);
    expect(tx).to.be.ok;

    const freeBalance = await clientA.getFreeBalance(tokenContract.address);
    console.log("freeBalance: ", freeBalance);
    expect(freeBalance[nodeSignerAddress].gt(0)).to.be.true;
  });
});
