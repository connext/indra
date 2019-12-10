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
  ethProvider: any;
  keyGen: CFCoreTypes.IPrivateKeyGenerator;
  lockService?: CFCoreTypes.ILockService;
  messaging: any;
  networkContext: NetworkContext;
  nodeConfig: any;
  nodeUrl: string;
  xpub: string;
  store: Store;
}

export type RpcConnection = ChannelProvider | any;
