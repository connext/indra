import { ChannelSigner } from "@connext/utils";
import { providers, Wallet } from "ethers";

import { ConfigService } from "../../config/config.service";
import { LoggerService } from "../../logger/logger.service";
import { Address } from "@connext/types";

export const env = {
  chainProviders: JSON.parse(process.env.INDRA_CHAIN_PROVIDERS!),
  contractAddresses: JSON.parse(process.env.INDRA_CONTRACT_ADDRESSES!),
  defaultChain: parseInt(process.env.INDRA_DEFAULT_CHAIN || "0", 10),
  indraLogLevel: parseInt(process.env.INDRA_LOG_LEVEL || "0", 10),
  logLevel: parseInt(process.env.CLIENT_LOG_LEVEL || "0", 10),
  messagingUrl: "nats://indra_nats_node_tester:4222",
  mnemonic: process.env.INDRA_MNEMONIC,
  nodeUrl: "http://localhost:8080",
  database: {
    database: process.env.INDRA_PG_DATABASE || "indra",
    host: process.env.INDRA_PG_HOST || "database",
    password: process.env.INDRA_PG_PASSWORD || "indra",
    port: parseInt(process.env.INDRA_PG_PORT || "5432", 10),
    username: process.env.INDRA_PG_USERNAME || "indra",
  },
};

export const ethProviderUrl = env.chainProviders[env.defaultChain];

export const defaultSigner = new ChannelSigner(
  Wallet.fromMnemonic(env.mnemonic!).privateKey,
  ethProviderUrl,
);

// add overrides as needed in tests
export type ConfigOverrides = {
  signer: ChannelSigner;
  extraSupportedTokens: { [chainId: number]: string[] };
};

export class MockConfigService extends ConfigService {
  private nodeSigner: ChannelSigner;
  private supportedTokens: { [chainId: number]: Address[] };

  constructor(overrides: Partial<ConfigOverrides> = {}) {
    super(new LoggerService("Test"));
    this.nodeSigner = overrides.signer || defaultSigner;
    const realSupported = super.getSupportedTokens();
    Object.keys(overrides.extraSupportedTokens || []).forEach((chainId) => {
      realSupported[chainId] = realSupported[chainId].concat(
        overrides.extraSupportedTokens![chainId],
      );
    });
    this.supportedTokens = realSupported;
  }
  getEthProvider = () => new providers.JsonRpcProvider(this.getProviderUrls()[0]);
  getProviderUrls = () => [ethProviderUrl!];
  getLogLevel = (): number => env.indraLogLevel;
  getPublicIdentifier = () => this.getSigner().publicIdentifier;
  getSigner = () => this.nodeSigner;
  getSignerAddress = async () => this.getSigner().address;
  getSupportedTokens = (): { [chainId: number]: Address[] } => this.supportedTokens;
  getPostgresConfig(): any {
    return {
      ...env.database,
      keepConnectionAlive: true,
      logging: [],
    };
  }

}
