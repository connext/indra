import { ChannelSigner, getChainId } from "@connext/utils";
import { ContractAddresses, IChannelSigner, MessagingConfig, SwapRate } from "@connext/types";
import { Injectable, OnModuleInit } from "@nestjs/common";
import { Wallet, providers, constants, utils } from "ethers";

import { RebalanceProfile } from "../rebalanceProfile/rebalanceProfile.entity";

const { AddressZero, Zero } = constants;
const { getAddress, parseEther } = utils;

type PostgresConfig = {
  database: string;
  host: string;
  password: string;
  port: number;
  username: string;
};

type TestnetTokenConfig = TokenConfig[];

type TokenConfig = {
  chainId: number;
  address: string;
}[];

@Injectable()
export class ConfigService implements OnModuleInit {
  private readonly envConfig: { [key: string]: string };
  private readonly signer: IChannelSigner;
  private ethProvider: providers.JsonRpcProvider;

  constructor() {
    this.envConfig = process.env;
    // NOTE: will be reassigned in module-init (WHICH NOTHING ACTUALLY
    // WAITS FOR)
    this.ethProvider = new providers.JsonRpcProvider(this.getEthRpcUrl());
    this.signer = new ChannelSigner(this.getPrivateKey(), this.ethProvider);
  }

  get(key: string): string {
    return this.envConfig[key];
  }

  private getPrivateKey(): string {
    return Wallet.fromMnemonic(this.get(`INDRA_ETH_MNEMONIC`)).privateKey;
  }

  getSigner(): IChannelSigner {
    return this.signer;
  }

  getEthRpcUrl(): string {
    return this.get(`INDRA_ETH_RPC_URL`);
  }

  getEthProvider(): providers.JsonRpcProvider {
    return this.ethProvider;
  }

  async getEthNetwork(): Promise<providers.Network> {
    const ethNetwork = await this.getEthProvider().getNetwork();
    if (ethNetwork.name === `unknown` && ethNetwork.chainId === 1337) {
      ethNetwork.name = `ganache`;
    } else if (ethNetwork.chainId === 1) {
      ethNetwork.name = `homestead`;
    }
    return ethNetwork;
  }

  getEthAddressBook() {
    return JSON.parse(this.get(`INDRA_ETH_CONTRACT_ADDRESSES`));
  }

  getSupportedChains() {
    return JSON.parse(this.get(`INDRA_SUPPORTED_CHAINS`));
  }

  async getContractAddresses(chainId?: string): Promise<ContractAddresses> {
    chainId = chainId ? chainId : (await this.getEthNetwork()).chainId.toString();
    const ethAddresses = {} as any;
    const ethAddressBook = this.getEthAddressBook();
    Object.keys(ethAddressBook[chainId]).forEach(
      (contract: string) =>
        (ethAddresses[contract] = getAddress(ethAddressBook[chainId][contract].address)),
    );
    return ethAddresses as ContractAddresses;
  }

  async getTokenAddress(): Promise<string> {
    const chainId = (await this.getEthNetwork()).chainId.toString();
    const ethAddressBook = this.getEthAddressBook();
    return getAddress(ethAddressBook[chainId].Token.address);
  }

  async getTestnetTokenConfig(): Promise<TestnetTokenConfig> {
    const testnetTokenConfig: TokenConfig[] = this.get("INDRA_TESTNET_TOKEN_CONFIG")
      ? JSON.parse(this.get("INDRA_TESTNET_TOKEN_CONFIG"))
      : [];
    const currentChainId = (await this.getEthNetwork()).chainId;

    // by default, map token address to mainnet token address
    if (currentChainId !== 1) {
      const contractAddresses = await this.getContractAddresses("1");
      testnetTokenConfig.push([
        {
          address: contractAddresses.Token,
          chainId: 1,
        },
        { address: await this.getTokenAddress(), chainId: currentChainId },
      ]);
    }
    return testnetTokenConfig;
  }

  async getTokenAddressForSwap(tokenAddress: string): Promise<string> {
    const currentChainId = (await this.getEthNetwork()).chainId;

    if (currentChainId !== 1) {
      const tokenConfig = await this.getTestnetTokenConfig();
      const configIndex = tokenConfig.findIndex((tc) =>
        tc.find((t) => t.chainId === currentChainId && t.address === tokenAddress),
      );
      const configExists =
        configIndex < 0 ? undefined : tokenConfig[configIndex].find((tc) => tc.chainId === 1);
      tokenAddress = configExists ? configExists.address : tokenAddress;
    }

    return tokenAddress;
  }

  /**
   * Combination of swaps plus extra supported tokens.
   */
  getSupportedTokenAddresses(): string[] {
    const swaps = this.getAllowedSwaps();
    const tokens = swaps.reduce(
      (tokensArray, swap) => tokensArray.concat([swap.from, swap.to]),
      [],
    );
    tokens.push(AddressZero);
    tokens.push(...this.getSupportedTokens());
    const tokenSet = new Set(tokens);
    return [...tokenSet].map((token) => getAddress(token));
  }

  getAllowedSwaps(): SwapRate[] {
    return JSON.parse(this.get("INDRA_ALLOWED_SWAPS"));
  }

  /**
   * Can add supported tokens to collateralize in addition to swap based tokens.
   */
  getSupportedTokens(): string[] {
    const tokens = this.get("INDRA_SUPPORTED_TOKENS")?.split(",");
    const dedup = new Set(tokens || []);
    return [...dedup];
  }

  async getHardcodedRate(from: string, to: string): Promise<string | undefined> {
    const swaps = this.getAllowedSwaps();
    const swap = swaps.find((s) => s.from === from && s.to === to);
    if (swap && swap.rate) {
      return swap.rate;
    } else {
      return this.getDefaultSwapRate(from, to);
    }
  }

  async getDefaultSwapRate(from: string, to: string): Promise<string | undefined> {
    const tokenAddress = await this.getTokenAddress();
    if (from === AddressZero && to === tokenAddress) {
      return "100.0";
    }
    if (from === tokenAddress && to === AddressZero) {
      return "0.01";
    }
    return undefined;
  }

  getPublicIdentifier(): string {
    return this.signer.publicIdentifier;
  }

  async getSignerAddress(): Promise<string> {
    return this.signer.getAddress();
  }

  getLogLevel(): number {
    return parseInt(this.get(`INDRA_LOG_LEVEL`) || `3`, 10);
  }

  isDevMode(): boolean {
    return this.get(`NODE_ENV`) !== `production`;
  }

  getMessagingConfig(): MessagingConfig {
    return {
      clusterId: this.get(`INDRA_NATS_CLUSTER_ID`),
      messagingUrl: (this.get(`INDRA_NATS_SERVERS`) || ``).split(`,`),
      privateKey: (this.get(`INDRA_NATS_JWT_SIGNER_PRIVATE_KEY`) || ``).replace(/\\n/g, "\n"),
      publicKey: (this.get(`INDRA_NATS_JWT_SIGNER_PUBLIC_KEY`) || ``).replace(/\\n/g, "\n"),
      token: this.get(`INDRA_NATS_TOKEN`),
      // websocketUrl: (this.get(`INDRA_NATS_WS_ENDPOINT`) || ``).split(`,`),
    };
  }

  getMessagingKey(): string {
    return `INDRA`;
  }

  getPort(): number {
    return parseInt(this.get(`INDRA_PORT`), 10);
  }

  getPostgresConfig(): PostgresConfig {
    return {
      database: this.get(`INDRA_PG_DATABASE`),
      host: this.get(`INDRA_PG_HOST`),
      password: this.get(`INDRA_PG_PASSWORD`),
      port: parseInt(this.get(`INDRA_PG_PORT`), 10),
      username: this.get(`INDRA_PG_USERNAME`),
    };
  }

  getRedisUrl(): string {
    return this.get(`INDRA_REDIS_URL`);
  }

  getRebalancingServiceUrl(): string | undefined {
    return this.get(`INDRA_REBALANCING_SERVICE_URL`);
  }

  async getDefaultRebalanceProfile(
    assetId: string = AddressZero,
  ): Promise<RebalanceProfile | undefined> {
    if (assetId === AddressZero) {
      return {
        assetId: AddressZero,
        channels: [],
        id: 0,
        collateralizeThreshold: parseEther(`0.05`),
        target: parseEther(`0.1`),
        reclaimThreshold: Zero,
      };
    }
    return {
      assetId,
      channels: [],
      id: 0,
      collateralizeThreshold: parseEther(`5`),
      target: parseEther(`20`),
      reclaimThreshold: Zero,
    };
  }

  async getZeroRebalanceProfile(
    assetId: string = AddressZero,
  ): Promise<RebalanceProfile | undefined> {
    if (assetId === AddressZero) {
      return {
        assetId: AddressZero,
        channels: [],
        id: 0,
        collateralizeThreshold: Zero,
        target: Zero,
        reclaimThreshold: Zero,
      };
    }
    return {
      assetId,
      channels: [],
      id: 0,
      collateralizeThreshold: Zero,
      target: Zero,
      reclaimThreshold: Zero,
    };
  }

  async onModuleInit(): Promise<void> {
    const providerUrl = this.getEthRpcUrl();
    this.ethProvider = new providers.JsonRpcProvider(providerUrl, await getChainId(providerUrl));
    this.signer.connect(this.ethProvider);
  }
}
