import { ChannelSigner } from "@connext/utils";
import { providers, Wallet } from "ethers";

import { ConfigService } from "../../config/config.service";

export const env = {
  ethProviderUrl: process.env.INDRA_ETH_RPC_URL,
  indraLogLevel: parseInt(process.env.INDRA_LOG_LEVEL || "0", 10),
  logLevel: parseInt(process.env.LOG_LEVEL || "0", 10),
  mnemonic: process.env.INDRA_ETH_MNEMONIC,
};

export const defaultSigner = new ChannelSigner(
  Wallet.fromMnemonic(env.mnemonic).privateKey,
  env.ethProviderUrl,
);

// add overrides as needed in tests
export type ConfigOverrides = {
  signer: ChannelSigner;
  extraSupportedTokens: string[];
};

export class MockConfigService extends ConfigService {
  private nodeSigner: ChannelSigner;
  private supportedTokens: string[];

  constructor(overrides: Partial<ConfigOverrides> = {}) {
    super();
    this.nodeSigner = overrides.signer || defaultSigner;
    this.supportedTokens = super
      .getSupportedTokenAddresses()
      .concat(overrides.extraSupportedTokens || []);
  }
  getEthProvider = () => new providers.JsonRpcProvider(this.getEthRpcUrl());
  getEthRpcUrl = () => env.ethProviderUrl!;
  getLogLevel = (): number => env.indraLogLevel;
  getPublicIdentifier = () => this.getSigner().publicIdentifier;
  getSigner = () => this.nodeSigner;
  getSignerAddress = async () => this.getSigner().address;
  getSupportedTokenAddresses = (): string[] => this.supportedTokens;
}
