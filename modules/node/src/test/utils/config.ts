import { ChannelSigner } from "@connext/utils";
import { constants, providers, Wallet } from "ethers";

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

export class MockConfigService extends ConfigService {
  private nodeSigner;
  constructor(signer: ChannelSigner = defaultSigner) {
    super();
    this.nodeSigner = signer;
  }
  getEthProvider = () => new providers.JsonRpcProvider(this.getEthRpcUrl());
  getEthRpcUrl = () => env.ethProviderUrl;
  getLogLevel = (): number => env.indraLogLevel;
  getPublicIdentifier = () => this.getSigner().publicIdentifier;
  getSigner = () => this.nodeSigner;
  getSignerAddress = async () => this.getSigner().address;
  getSupportedTokenAddresses = (): string[] => this.getSupportedTokens();
  getSupportedTokens = (): string[] => [constants.AddressZero];
}
