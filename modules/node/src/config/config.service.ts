import { ConnextToken } from "@connext/contracts";
import {
  Address,
  ContractAddresses,
  IChannelSigner,
  MessagingConfig,
  ContractAddressBook,
  AddressBook,
  AllowedSwap,
  PriceOracleTypes,
  NetworkContexts,
  JsonRpcProvider,
} from "@connext/types";
import { ChannelSigner, getEthProvider } from "@connext/utils";
import { Injectable, OnModuleInit } from "@nestjs/common";
import { Wallet, Contract, providers, constants, utils, BigNumber } from "ethers";

import { DEFAULT_DECIMALS } from "../constants";
import { LoggerService } from "../logger/logger.service";
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

type MaxCollateralMap<T = string> = {
  [assetId: string]: T;
};

@Injectable()
export class ConfigService implements OnModuleInit {
  private readonly envConfig: { [key: string]: string };
  // signer on same mnemonic, connected to different providers
  public readonly signers: Map<number, IChannelSigner> = new Map();
  // keyed on chainId
  public readonly providers: Map<number, providers.JsonRpcProvider> = new Map();

  constructor(private readonly log: LoggerService) {
    this.log.setContext("ConfigService");
    this.envConfig = process.env as any;
    // NOTE: will be reassigned in module-init (WHICH NOTHING ACTUALLY WAITS FOR)
    const urls = this.getProviderUrls();
    this.getSupportedChains().forEach((chainId, idx) => {
      const provider = getEthProvider(urls[idx], chainId);
      this.providers.set(chainId, provider);
      this.signers.set(chainId, new ChannelSigner(this.getPrivateKey(), provider));
      this.log.info(`Registered new provider at url ${urls[idx]} & signer for chain ${chainId}`);
    });
  }

  getAdminToken(): string {
    return this.get("INDRA_ADMIN_TOKEN");
  }

  get(key: string): string {
    return this.envConfig[key];
  }

  private getPrivateKey(): string {
    return Wallet.fromMnemonic(this.get(`INDRA_MNEMONIC`)).privateKey;
  }

  getSigner(chainId?: number): IChannelSigner {
    if (chainId) {
      const providers = this.getIndraChainProviders();
      const provider = getEthProvider(providers[chainId], chainId);
      const signer = new ChannelSigner(this.getPrivateKey(), provider);
      return signer;
    }
    return new ChannelSigner(this.getPrivateKey());
  }

  getProviderUrls(): string[] {
    // default to first option in env
    return Object.values(JSON.parse(this.get(`INDRA_CHAIN_PROVIDERS`)));
  }

  getEthProvider(chainId: number): providers.JsonRpcProvider | undefined {
    return this.providers.get(chainId);
  }

  getEthProviders(): providers.JsonRpcProvider[] {
    return Array.from(this.providers.values());
  }

  getAddressBook(): AddressBook {
    return JSON.parse(this.get(`INDRA_CONTRACT_ADDRESSES`));
  }

  getSupportedChains(): number[] {
    return (
      Object.keys(JSON.parse(this.get("INDRA_CHAIN_PROVIDERS"))).map((k) => parseInt(k, 10)) || []
    );
  }

  getIndraChainProviders(): { [k: string]: string } {
    return JSON.parse(this.get("INDRA_CHAIN_PROVIDERS") || "{}");
  }

  async getNetwork(chainId: number): Promise<providers.Network> {
    const provider = this.getEthProvider(chainId);
    if (!provider) {
      throw new Error(`Node is not configured for chain ${chainId}`);
    }
    const network = await provider.getNetwork();
    network.chainId = chainId; // just in case we're using ganache which hardcodes it's chainId..
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

  async getTokenDecimals(chainId: number, providedAddress?: Address): Promise<number> {
    const address = providedAddress || (await this.getTokenAddress(chainId));
    const tokenContract = new Contract(address, ConnextToken.abi, this.getSigner(chainId));
    let decimals = DEFAULT_DECIMALS;
    try {
      decimals = await tokenContract.decimals();
    } catch (e) {
      this.log.warn(`Could not retrieve decimals from token ${address}, using ${DEFAULT_DECIMALS}`);
    }
    return decimals;
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

  getNetworkContexts(): NetworkContexts {
    const ethAddressBook = this.getAddressBook();
    const supportedChains = this.getSupportedChains();

    return supportedChains.reduce((contexts, chainId) => {
      contexts[chainId] = {
        contractAddresses: Object.keys(ethAddressBook[chainId]).reduce(
          (addresses, contractName) => {
            addresses[contractName] = getAddress(ethAddressBook[chainId][contractName].address);
            return addresses;
          },
          {},
        ),
        provider: this.getEthProvider(chainId),
      };
      return contexts;
    }, {});
  }

  getTokenAddress(chainId: number): string {
    const ethAddressBook = this.getAddressBook();
    if (!ethAddressBook[chainId]) {
      throw new Error(`Chain ${chainId} is not supported`);
    }
    if (!ethAddressBook[chainId].Token) {
      throw new Error(`Chain ${chainId} does not contain any supported tokens`);
    }
    return getAddress(ethAddressBook[chainId].Token.address);
  }

  getAllowedSwaps(chainId: number): AllowedSwap[] {
    // configured tokens per chain in address book
    const addressBook = this.getAddressBook();
    const chains = this.getSupportedChains();
    const supportedTokens: { [chainId: number]: Address[] } = chains.reduce((tokens, chainId) => {
      if (!tokens[chainId]) {
        tokens[chainId] = [AddressZero];
      }
      tokens[chainId].push(addressBook[chainId]?.Token?.address);
      return tokens;
    }, {});
    if (!supportedTokens[chainId]) {
      this.log.warn(`There are no supported tokens for chain ${chainId}`);
      return [];
    }
    const priceOracleType =
      chainId.toString() === "1" ? PriceOracleTypes.UNISWAP : PriceOracleTypes.HARDCODED;
    let allowedSwaps: AllowedSwap[] = [];
    // allow token <> eth swaps per chain
    supportedTokens[chainId]
      .filter((token) => token !== AddressZero)
      .forEach((token) => {
        allowedSwaps.push({
          from: token,
          to: AddressZero,
          priceOracleType,
          fromChainId: chainId,
          toChainId: chainId,
        });
        allowedSwaps.push({
          from: AddressZero,
          to: token,
          priceOracleType,
          fromChainId: chainId,
          toChainId: chainId,
        });
      });

    const extraSwaps: AllowedSwap[] = JSON.parse(this.get("INDRA_ALLOWED_SWAPS") || "[]");
    allowedSwaps = allowedSwaps.concat(
      extraSwaps.map((swap) => {
        return {
          ...swap,
          fromChainId: parseInt(swap.fromChainId as any),
          toChainId: parseInt(swap.toChainId as any),
        };
      }),
    );

    return allowedSwaps;
  }

  getSupportedTokens(): { [chainId: number]: Address[] } {
    const addressBook = this.getAddressBook();
    const chains = this.getSupportedChains();
    const supportedTokens: { [chainId: number]: Address[] } = chains.reduce((tokens, chainId) => {
      if (!tokens[chainId]) {
        tokens[chainId] = [AddressZero];
      }
      tokens[chainId].push(addressBook[chainId]?.Token?.address);
      return tokens;
    }, {});

    const extraTokens: { [chainId: number]: Address[] } = JSON.parse(
      this.get("INDRA_SUPPORTED_TOKENS") || "{}",
    );
    Object.keys(extraTokens).forEach((chainId) => {
      if (!supportedTokens[chainId]) {
        throw new Error(`Unsupported chainId in INDRA_SUPPORTED_TOKENS: ${chainId}`);
      }
      supportedTokens[chainId] = supportedTokens[chainId].concat(extraTokens[chainId]);
    });
    return supportedTokens;
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

  getAppCleanupInterval(): number {
    return parseInt(this.get(`INDRA_APP_CLEANUP_INTERVAL`) || "3600000");
  }

  getDefaultRebalanceProfile(assetId: string = AddressZero): RebalanceProfile | undefined {
    if (assetId === AddressZero) {
      let defaultProfileEth = {
        collateralizeThreshold: parseEther(`0.05`),
        target: parseEther(`0.1`),
        reclaimThreshold: parseEther(`0.5`),
      };
      try {
        const parsed = JSON.parse(this.get("INDRA_DEFAULT_REBALANCE_PROFILE_ETH"));
        if (parsed) {
          defaultProfileEth = {
            collateralizeThreshold: BigNumber.from(parsed.collateralizeThreshold),
            target: BigNumber.from(parsed.target),
            reclaimThreshold: BigNumber.from(parsed.reclaimThreshold),
          };
        }
      } catch (e) {}
      return {
        assetId: AddressZero,
        channels: [],
        id: 0,
        ...defaultProfileEth,
      };
    }
    let defaultProfileToken = {
      collateralizeThreshold: parseEther(`5`),
      target: parseEther(`20`),
      reclaimThreshold: parseEther(`100`),
    };
    try {
      const parsed = JSON.parse(this.get("INDRA_DEFAULT_REBALANCE_PROFILE_TOKEN"));
      if (parsed) {
        defaultProfileToken = {
          collateralizeThreshold: BigNumber.from(parsed.collateralizeThreshold),
          target: BigNumber.from(parsed.target),
          reclaimThreshold: BigNumber.from(parsed.reclaimThreshold),
        };
      }
    } catch (e) {}
    return {
      assetId,
      channels: [],
      id: 0,
      ...defaultProfileToken,
    };
  }

  getZeroRebalanceProfile(assetId: string = AddressZero): RebalanceProfile | undefined {
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
    for (const [providerMappedChain, provider] of [...this.providers.entries()]) {
      const actualChain = BigNumber.from(await provider.send("eth_chainId", [])).toNumber();
      if (actualChain !== providerMappedChain) {
        throw new Error(
          `actualChain !== providerMappedChain, ${actualChain} !== ${providerMappedChain}`,
        );
      }
    }

    // Make sure all signers are properly connected
    for (const [signerMappedChain, signer] of [...this.signers.entries()]) {
      const actualChain = await signer.getChainId();
      if (actualChain !== signerMappedChain) {
        throw new Error(
          `actualChain !== signerMappedChain, ${actualChain} !== ${signerMappedChain}`,
        );
      }
      await signer.connectProvider(this.getEthProvider(signerMappedChain)!);
    }
  }
}
