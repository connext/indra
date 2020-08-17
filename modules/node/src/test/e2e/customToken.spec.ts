import { connect } from "@connext/client";
import { getMemoryStore } from "@connext/store";
import { ColorfulLogger, logTime, getRandomChannelSigner, getChainId } from "@connext/utils";
import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { Wallet, ContractFactory, Contract, providers, BigNumber } from "ethers";
import { parseUnits } from "ethers/lib/utils";

import { AppModule } from "../../app.module";
import { ChannelRepository } from "../../channel/channel.repository";
import { ChannelService, RebalanceType } from "../../channel/channel.service";
import { ConfigService } from "../../config/config.service";

import { env, ethProviderUrl, expect, MockConfigService } from "../utils";
import token from "../utils/contractArtifacts/NineDecimalToken.json";

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

    sugarDaddy = Wallet.fromMnemonic(env.mnemonic).connect(
      new providers.JsonRpcProvider(ethProviderUrl, await getChainId(ethProviderUrl)),
    );

    const factory = new ContractFactory(token.abi, token.bytecode, sugarDaddy);
    tokenContract = await factory.deploy("Test", "TST");
    expect(tokenContract.address).to.be.ok;

    const chainId = env.defaultChain;
    configService = new MockConfigService({
      extraSupportedTokens: { [chainId]: [tokenContract.address] },
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

    const decimals = await configService.getTokenDecimals(chainId);
    expect(decimals.toString()).to.eq("9");
    const supportedTokens = configService.getSupportedTokens();
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
    const chainId = configService.getSupportedChains()[0];
    const clientA = await connect({
      store: getMemoryStore(),
      signer: getRandomChannelSigner(configService.getEthProvider(chainId)),
      ethProviderUrl,
      messagingUrl: configService.getMessagingConfig().messagingUrl[0],
      nodeUrl: env.nodeUrl,
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

    expect(tx).to.be.ok;

    const freeBalance = await clientA.getFreeBalance(tokenContract.address);
    expect(freeBalance[nodeSignerAddress].gt(0)).to.be.true;
  });
});
