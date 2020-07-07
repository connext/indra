import { ChannelSigner } from "@connext/utils";
import {
  ContractAddresses,
  IChannelSigner,
  MessagingConfig,
  PriceOracleTypes,
  AllowedSwap,
  ContractAddressBook,
  AddressBook,
} from "@connext/types";
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

@Injectable()
export class ConfigService implements OnModuleInit {
  private readonly envConfig: { [key: string]: string };
  // signer on same mnemonic, connected to different providers
  private readonly signers: Map<number, IChannelSigner> = new Map();
  // keyed on chainId
  public readonly providers: Map<number, providers.JsonRpcProvider> = new Map();

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
    return Object.values(JSON.parse(this.get(`INDRA_CHAIN_PROVIDERS`)));
  }

  getEthProvider(chainId: number): providers.JsonRpcProvider {
    return this.providers.get(chainId);
  }

  getEthProviders(): providers.JsonRpcProvider[] {
    return Array.from(this.providers.values());
  }

  getAddressBook(): AddressBook {
    return JSON.parse(this.get(`INDRA_ETH_CONTRACT_ADDRESSES`));
  }

  getSupportedChains(): number[] {
    return Object.keys(JSON.parse(this.get("INDRA_CHAIN_PROVIDERS"))).map((k) => parseInt(k, 10));
  }

  async getNetwork(chainId: number): Promise<providers.Network> {
    const network = await this.getEthProvider(chainId).getNetwork();
    if (network.name === `unknown` && network.chainId === 1337) {
      network.name = `ganache`;
    } else if (network.chainId === 1) {
      network.name = `homestead`;
    }
    return network;
  }

  getContractAddresses(chainId: number): ContractAddresses {
    const ethAddresses = { [chainId]: {} } as any;
    const ethAddressBook = this.getAddressBook();
    Object.keys(ethAddressBook[chainId]).forEach(
      (contract: string) =>
        (ethAddresses[chainId][contract] = getAddress(ethAddressBook[chainId][contract].address)),
    );
    return ethAddresses[chainId] as ContractAddresses;
  }

  getContractAddressBook(): ContractAddressBook {
    const ethAddresses = {};
    const ethAddressBook = this.getAddressBook();
    this.getSupportedChains().forEach((chainId) => {
      ethAddresses[chainId] = {};
      Object.keys(ethAddressBook[chainId]).forEach((contractName) => {
        ethAddresses[chainId][contractName] = getAddress(
          ethAddressBook[chainId][contractName].address,
        );
      });
    });
    return ethAddresses as ContractAddressBook;
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

  getAllowedSwaps(): AllowedSwap[] {
    const supportedTokens = this.getSupportedTokens();
    const priceOracleType =
      this.get("NODE_ENV") === "development"
        ? PriceOracleTypes.HARDCODED
        : PriceOracleTypes.UNISWAP;
    const allowedSwaps: AllowedSwap[] = [];
    supportedTokens.forEach((token) => {
      allowedSwaps.push({ from: token, to: AddressZero, priceOracleType });
      allowedSwaps.push({ from: AddressZero, to: token, priceOracleType });
    });
    return allowedSwaps;
  }

  getSupportedTokens(): string[] {
    const addressBook = this.getAddressBook();
    const chains = this.getSupportedChains();
    const tokens = chains.map((chainId) => addressBook[chainId].Token.address).filter((a) => !!a);
    return [...new Set([AddressZero].concat(tokens))];
  }

  async getHardcodedRate(from: string, to: string): Promise<string | undefined> {
    if (from === AddressZero && to !== AddressZero) {
      return "100.0";
    }
    if (from !== AddressZero && to === AddressZero) {
      return "0.01";
    }
    return "1";
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
