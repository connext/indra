import { ChannelSigner } from "@connext/utils";
import { ContractAddresses, IChannelSigner, MessagingConfig, SwapRate } from "@connext/types";
import { Injectable, OnModuleInit } from "@nestjs/common";
import { Wallet, providers, constants, utils } from "ethers";
import { Memoize } from "typescript-memoize";

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
  private readonly ethProvider: providers.JsonRpcProvider;
  private signer: IChannelSigner;

  constructor() {
    this.envConfig = process.env;
    this.ethProvider = new providers.JsonRpcProvider(this.getEthRpcUrl());
    this.signer = new ChannelSigner(this.getPrivateKey(), this.getEthRpcUrl());
  }

  get(key: string): string {
    return this.envConfig[key];
  }

  @Memoize()
  private getPrivateKey(): string {
    return Wallet.fromMnemonic(this.get(`INDRA_ETH_MNEMONIC`)).privateKey;
  }

  @Memoize()
  getSigner(): IChannelSigner {
    return this.signer;
  }

  @Memoize()
  getEthRpcUrl(): string {
    return this.get(`INDRA_ETH_RPC_URL`);
  }

  @Memoize()
  getEthProvider(): providers.JsonRpcProvider {
    return this.ethProvider;
  }

  @Memoize()
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

  @Memoize()
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

  @Memoize()
  async getTokenAddress(): Promise<string> {
    const chainId = (await this.getEthNetwork()).chainId.toString();
    const ethAddressBook = JSON.parse(this.get(`INDRA_ETH_CONTRACT_ADDRESSES`));
    return getAddress(ethAddressBook[chainId].Token.address);
  }

  @Memoize()
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

  @Memoize()
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
  @Memoize()
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

  @Memoize()
  getAllowedSwaps(): SwapRate[] {
    return JSON.parse(this.get("INDRA_ALLOWED_SWAPS"));
  }

  /**
   * Can add supported tokens to collateralize in addition to swap based tokens.
   */
  @Memoize()
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

  @Memoize()
  getPublicIdentifier(): string {
    return this.signer.publicIdentifier;
  }

  @Memoize()
  async getSignerAddress(): Promise<string> {
    return this.signer.getAddress();
  }

  @Memoize()
  getLogLevel(): number {
    return parseInt(this.get(`INDRA_LOG_LEVEL`) || `3`, 10);
  }

  @Memoize()
  isDevMode(): boolean {
    return this.get(`NODE_ENV`) !== `production`;
  }

  @Memoize()
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

  @Memoize()
  getMessagingKey(): string {
    return `INDRA`;
  }

  @Memoize()
  getPort(): number {
    return parseInt(this.get(`INDRA_PORT`), 10);
  }

  @Memoize()
  getPostgresConfig(): PostgresConfig {
    return {
      database: this.get(`INDRA_PG_DATABASE`),
      host: this.get(`INDRA_PG_HOST`),
      password: this.get(`INDRA_PG_PASSWORD`),
      port: parseInt(this.get(`INDRA_PG_PORT`), 10),
      username: this.get(`INDRA_PG_USERNAME`),
    };
  }

  @Memoize()
  getRedisUrl(): string {
    return this.get(`INDRA_REDIS_URL`);
  }

  @Memoize()
  getRebalancingServiceUrl(): string | undefined {
    return this.get(`INDRA_REBALANCING_SERVICE_URL`);
  }

  @Memoize()
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

  @Memoize()
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

  async onModuleInit(): Promise<void> {}
}
