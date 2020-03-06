import { MessagingConfig } from "@connext/messaging";
import {
  ContractAddresses,
  DefaultApp,
  SupportedApplication,
  SimpleTransferApp,
  SimpleTwoPartySwapApp,
  SimpleLinkedTransferApp,
  CoinBalanceRefundApp,
  SwapRate,
} from "@connext/types";
import { Injectable, OnModuleInit } from "@nestjs/common";
import { Wallet } from "ethers";
import { AddressZero, Zero } from "ethers/constants";
import { JsonRpcProvider } from "ethers/providers";
import { getAddress, Network as EthNetwork, parseEther } from "ethers/utils";

import { RebalanceProfile } from "../rebalanceProfile/rebalanceProfile.entity";
import { OutcomeType } from "../util/cfCore";

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

const singleAssetTwoPartyCoinTransferEncoding = `tuple(address to, uint256 amount)[2]`;

const multiAssetMultiPartyCoinTransferEncoding = `tuple(address to, uint256 amount)[][]`;

@Injectable()
export class ConfigService implements OnModuleInit {
  private readonly envConfig: { [key: string]: string };
  private readonly ethProvider: JsonRpcProvider;
  private wallet: Wallet;

  constructor() {
    this.envConfig = process.env;
    this.ethProvider = new JsonRpcProvider(this.getEthRpcUrl());
  }

  get(key: string): string {
    return this.envConfig[key];
  }

  getEthRpcUrl(): string {
    return this.get(`INDRA_ETH_RPC_URL`);
  }

  getEthProvider(): JsonRpcProvider {
    return this.ethProvider;
  }

  getEthWallet(): Wallet {
    return this.wallet;
  }

  async getEthNetwork(): Promise<EthNetwork> {
    const ethNetwork = await this.getEthProvider().getNetwork();
    if (ethNetwork.name === `unknown` && ethNetwork.chainId === 4447) {
      ethNetwork.name = `ganache`;
    } else if (ethNetwork.chainId === 1) {
      ethNetwork.name = `homestead`;
    }
    return ethNetwork;
  }

  getEthAddressBook() {
    return JSON.parse(this.get(`INDRA_ETH_CONTRACT_ADDRESSES`));
  }

  async getContractAddresses(chainId?: string): Promise<ContractAddresses> {
    chainId = chainId ? chainId : (await this.getEthNetwork()).chainId.toString();
    const ethAddresses = {} as any;
    const ethAddressBook = this.getEthAddressBook();
    Object.keys(ethAddressBook[chainId]).map(
      (contract: string) =>
        (ethAddresses[contract] = getAddress(ethAddressBook[chainId][contract].address)),
    );
    return ethAddresses as ContractAddresses;
  }

  async getTokenAddress(): Promise<string> {
    const chainId = (await this.getEthNetwork()).chainId.toString();
    const ethAddressBook = JSON.parse(this.get(`INDRA_ETH_CONTRACT_ADDRESSES`));
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
      const configIndex = tokenConfig.findIndex(tc =>
        tc.find(t => t.chainId === currentChainId && t.address === tokenAddress),
      );
      const configExists =
        configIndex < 0 ? undefined : tokenConfig[configIndex].find(tc => tc.chainId === 1);
      tokenAddress = configExists ? configExists.address : tokenAddress;
    }

    return tokenAddress;
  }

  getSupportedTokenAddresses(): string[] {
    const swaps = this.getAllowedSwaps();
    const tokens = swaps.reduce(
      (tokensArray, swap) => tokensArray.concat([swap.from, swap.to]),
      [],
    );
    tokens.push(AddressZero);
    const tokenSet = new Set(tokens);
    return [...tokenSet];
  }

  getAllowedSwaps(): SwapRate[] {
    return JSON.parse(this.get("INDRA_ALLOWED_SWAPS"));
  }

  async getDefaultSwapRate(from: string, to: string): Promise<string | undefined> {
    const tokenAddress = await this.getTokenAddress();
    if (from === AddressZero && to === tokenAddress) {
      return "100.00";
    }
    if (from === tokenAddress && to === tokenAddress) {
      return "0.005";
    }
    return undefined;
  }

  async getDefaultAppByName(name: SupportedApplication): Promise<DefaultApp> {
    const apps = await this.getDefaultApps();
    return apps.filter((app: DefaultApp) => app.name === name)[0];
  }

  async getDefaultApps(): Promise<DefaultApp[]> {
    const ethNetwork = await this.getEthNetwork();
    const addressBook = await this.getContractAddresses();
    return [
      {
        allowNodeInstall: false,
        appDefinitionAddress: addressBook[SimpleTransferApp],
        chainId: ethNetwork.chainId,
        name: SimpleTransferApp,
        outcomeType: OutcomeType.SINGLE_ASSET_TWO_PARTY_COIN_TRANSFER,
        stateEncoding: `tuple(${singleAssetTwoPartyCoinTransferEncoding} coinTransfers)`,
      },
      {
        allowNodeInstall: true,
        appDefinitionAddress: addressBook[SimpleTwoPartySwapApp],
        chainId: ethNetwork.chainId,
        name: SimpleTwoPartySwapApp,
        outcomeType: OutcomeType.MULTI_ASSET_MULTI_PARTY_COIN_TRANSFER,
        stateEncoding: `tuple(${multiAssetMultiPartyCoinTransferEncoding} coinTransfers)`,
      },
      {
        actionEncoding: `tuple(bytes32 preImage)`,
        allowNodeInstall: true,
        appDefinitionAddress: addressBook[SimpleLinkedTransferApp],
        chainId: ethNetwork.chainId,
        name: SimpleLinkedTransferApp,
        outcomeType: OutcomeType.SINGLE_ASSET_TWO_PARTY_COIN_TRANSFER,
        stateEncoding: `tuple(${singleAssetTwoPartyCoinTransferEncoding} coinTransfers, bytes32 linkedHash, uint256 amount, address assetId, bytes32 paymentId, bytes32 preImage)`,
      },
      {
        allowNodeInstall: true,
        appDefinitionAddress: addressBook[CoinBalanceRefundApp],
        chainId: ethNetwork.chainId,
        name: CoinBalanceRefundApp,
        outcomeType: OutcomeType.SINGLE_ASSET_TWO_PARTY_COIN_TRANSFER,
        stateEncoding: `tuple(address recipient, address multisig, uint256 threshold, address tokenAddress)`,
      },
    ];
  }

  getLogLevel(): number {
    return parseInt(this.get(`INDRA_LOG_LEVEL`) || `3`, 10);
  }

  isDevMode(): boolean {
    return this.get(`NODE_ENV`) !== `production`;
  }

  getMnemonic(): string {
    return this.get(`INDRA_ETH_MNEMONIC`);
  }

  getMessagingConfig(): MessagingConfig {
    return {
      clusterId: this.get(`INDRA_NATS_CLUSTER_ID`),
      logLevel: this.getLogLevel(), // <- this is very verbose just fyi
      messagingUrl: (this.get(`INDRA_NATS_SERVERS`) || ``).split(`,`),
      token: this.get(`INDRA_NATS_TOKEN`),
    };
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
    const tokenAddress = await this.getTokenAddress();
    switch (assetId) {
      case AddressZero:
        return {
          assetId: AddressZero,
          channels: [],
          id: 0,
          lowerBoundCollateralize: parseEther(`0.05`),
          upperBoundCollateralize: parseEther(`0.1`),
          lowerBoundReclaim: Zero,
          upperBoundReclaim: Zero,
        };
      case tokenAddress:
        return {
          assetId: AddressZero,
          channels: [],
          id: 0,
          lowerBoundCollateralize: parseEther(`5`),
          upperBoundCollateralize: parseEther(`20`),
          lowerBoundReclaim: Zero,
          upperBoundReclaim: Zero,
        };
      default:
        return undefined;
    }
  }

  onModuleInit(): void {
    const wallet = Wallet.fromMnemonic(this.getMnemonic());
    this.wallet = wallet.connect(this.getEthProvider());
  }
}
