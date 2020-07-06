import { ChannelSigner } from "@connext/utils";
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
  // signer on same mnemonic, connected to different providers
  private readonly signers: Map<number, IChannelSigner> = new Map();
  // keyed on chainId
  private providers: Map<number, providers.JsonRpcProvider> = new Map();

  constructor() {
    this.envConfig = process.env;
    // NOTE: will be reassigned in module-init (WHICH NOTHING ACTUALLY WAITS FOR)
    const urls = this.getProviderUrls();
    this.getSupportedChains().forEach((chainId, idx) => {
      const provider = new providers.JsonRpcProvider(urls[idx], chainId);
      this.providers.set(chainId, provider);
      this.signers.set(chainId, new ChannelSigner(this.getPrivateKey(), provider));
    });
  }

  get(key: string): string {
    return this.envConfig[key];
  }

  private getPrivateKey(): string {
    return Wallet.fromMnemonic(this.get(`INDRA_ETH_MNEMONIC`)).privateKey;
  }

  getSigner(chainId: number): IChannelSigner {
    return this.signers.get(chainId);
  }

  getProviderUrls(): string[] {
    // default to first option in env
    return Object.keys(JSON.parse(this.get(`INDRA_CHAIN_PROVIDERS`)));
  }

  getProvider(chainId: number): providers.JsonRpcProvider {
    return this.providers.get(chainId);
  }

  async getNetwork(chainId: number): Promise<providers.Network> {
    const network = await this.getProvider(chainId).getNetwork();
    if (network.name === `unknown` && network.chainId === 1337) {
      network.name = `ganache`;
    } else if (network.chainId === 1) {
      network.name = `homestead`;
    }
    return network;
  }

  getAddressBook() {
    return JSON.parse(this.get(`INDRA_ETH_CONTRACT_ADDRESSES`));
  }

  getSupportedChains(): number[] {
    const chains = this.get("INDRA_SUPPORTED_CHAINS")?.split(",");
    const dedup = new Set(chains || []);
    return [...dedup].map((chain) => parseInt(chain, 10));
  }

  async getContractAddresses(chainId: number): Promise<ContractAddresses> {
    const ethAddresses = { [chainId]: {} } as any;
    const ethAddressBook = this.getAddressBook();
    Object.keys(ethAddressBook[chainId]).forEach(
      (contract: string) =>
        (ethAddresses[chainId][contract] = getAddress(ethAddressBook[chainId][contract].address)),
    );
    return ethAddresses[chainId] as ContractAddresses;
  }

  async getNetworkContexts(): Promise<{ [chainId: number]: ContractAddresses }> {
    const ethAddressBook = this.getAddressBook();
    const supportedChains = this.getSupportedChains();

    const ethAddresses = {};
    supportedChains.forEach((chainId) => {
      Object.keys(ethAddressBook[chainId]).forEach(
        (contract: string) =>
          (ethAddresses[chainId][contract] = getAddress(ethAddressBook[chainId][contract].address)),
      );
    });
    return ethAddresses as { [chainId: string]: ContractAddresses };
  }

  async getTokenAddress(chainId: number): Promise<string> {
    const ethAddressBook = this.getAddressBook();
    return getAddress(ethAddressBook[chainId].Token.address);
  }

  async getTestnetTokenConfig(): Promise<TestnetTokenConfig> {
    const testnetTokenConfig: TokenConfig[] = this.get("INDRA_TESTNET_TOKEN_CONFIG")
      ? JSON.parse(this.get("INDRA_TESTNET_TOKEN_CONFIG"))
      : [];
    const currentChainId = (await this.getAddressBook()).chainId;

    // by default, map token address to mainnet token address
    if (currentChainId !== 1) {
      const contractAddresses = await this.getContractAddresses(1);
      testnetTokenConfig.push([
        {
          address: contractAddresses.Token,
          chainId: 1,
        },
        { address: await this.getTokenAddress(currentChainId), chainId: currentChainId },
      ]);
    }
    return testnetTokenConfig;
  }

  async getTokenAddressForSwap(currentChainId: number, tokenAddress: string): Promise<string> {
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

  async getHardcodedRate(from: string, to: string, chainId: number): Promise<string | undefined> {
    const swaps = this.getAllowedSwaps();
    const swap = swaps.find((s) => s.from === from && s.to === to);
    if (swap && swap.rate) {
      return swap.rate;
    } else {
      return this.getDefaultSwapRate(from, to, chainId);
    }
  }

  async getDefaultSwapRate(from: string, to: string, chainId: number): Promise<string | undefined> {
    const tokenAddress = await this.getTokenAddress(chainId);
    if (from === AddressZero && to === tokenAddress) {
      return "100.0";
    }
    if (from === tokenAddress && to === AddressZero) {
      return "0.01";
    }
    return undefined;
  }

  // NOTE: assumes same signer accross chains
  getPublicIdentifier(): string {
    const [signer] = [...this.signers.values()];
    return signer.publicIdentifier;
  }

  // NOTE: assumes same signer accross chains
  async getSignerAddress(): Promise<string> {
    const [signer] = [...this.signers.values()];
    return signer.getAddress();
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

  async onModuleInit(): Promise<void> {}
}
