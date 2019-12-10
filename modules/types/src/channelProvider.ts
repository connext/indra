import { CFCoreTypes, NetworkContext } from "./cf";
import { Store } from "./client";

export type ChannelProvider = any;

export type ChannelProviderConfig = {
  freeBalanceAddress: string;
  multisigAddress?: string; // may not be deployed yet
  natsClusterId?: string;
  natsToken?: string;
  nodeUrl: string;
  signerAddress: string;
  userPublicIdentifier: string;
};

export interface CFChannelProviderOptions {
  messaging: any;
  store: Store;
  networkContext: NetworkContext;
  nodeConfig: any;
  ethProvider: any;
  lockService?: CFCoreTypes.ILockService;
  xpub: string;
  keyGen: CFCoreTypes.IPrivateKeyGenerator;
  nodeUrl: string;
}

export type RpcConnection = ChannelProvider | any;
