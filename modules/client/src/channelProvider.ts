import { Wallet } from "ethers";
import { arrayify } from "ethers/utils";
import { RpcParameters } from "rpc-server";

import { CFCore, xpubToAddress } from "./lib";
import {
  CFChannelProviderOptions,
  CFCoreTypes,
  ChannelProviderConfig,
  NewRpcMethodName,
  RpcConnection,
  Store,
  StorePair,
} from "./types";

export const createCFChannelProvider = async ({
  ethProvider,
  keyGen,
  lockService,
  messaging,
  networkContext,
  nodeConfig,
  nodeUrl,
  store,
  xpub,
}: CFChannelProviderOptions): Promise<ChannelProvider> => {
  const cfCore = await CFCore.create(
    messaging as any,
    store,
    networkContext,
    nodeConfig,
    ethProvider,
    lockService,
    xpub,
    keyGen,
  );
  const channelProviderConfig: ChannelProviderConfig = {
    freeBalanceAddress: xpubToAddress(xpub),
    nodeUrl,
    signerAddress: xpubToAddress(xpub),
    userPublicIdentifier: xpub,
  };
  const channelProvider = new ChannelProvider(
    cfCore,
    channelProviderConfig,
    store,
    await keyGen("0"),
  );
  return channelProvider;
};

export class ChannelProvider {
  private connection: RpcConnection;

  // TODO: replace this when signing keys are added!
  // shouldnt really ever be used
  private wallet: Wallet | undefined;
  private _config: ChannelProviderConfig; // tslint:disable-line: variable-name
  private _multisigAddress: string | undefined = undefined; // tslint:disable-line: variable-name
  private _signerAddress: string | undefined = undefined; // tslint:disable-line: variable-name
  private store: Store | undefined;

  constructor(
    connection: RpcConnection,
    config: ChannelProviderConfig,
    store: Store,
    authKey: any,
  ) {
    this.store = store;
    this.wallet = authKey ? new Wallet(authKey) : null;
    this.connection = connection;
    this._config = config;
    this._multisigAddress = config.multisigAddress;
    this._signerAddress = config.signerAddress;
  }

  public enable = async (): Promise<ChannelProviderConfig> => {
    return this.config;
  };

  public send = async (
    method: CFCoreTypes.RpcMethodName | NewRpcMethodName,
    params: any = {},
  ): Promise<any> => {
    let result;
    switch (method) {
      case NewRpcMethodName.STORE_SET:
        result = await this.set(params.pairs);
        break;
      case NewRpcMethodName.STORE_GET:
        result = await this.get(params.path);
        break;
      case NewRpcMethodName.NODE_AUTH:
        result = await this.signMessage(params.message);
        break;
      case NewRpcMethodName.CONFIG:
        result = this.config;
        break;
      case NewRpcMethodName.RESTORE_STATE:
        result = await this.restoreState(params.path);
        break;
      default:
        result = await this._send(method as CFCoreTypes.RpcMethodName, params);
        break;
    }

    return result;
  };

  ///////////////////////////////////////////////
  ///// GETTERS / SETTERS
  get config(): ChannelProviderConfig {
    return this._config;
  }

  get multisigAddress(): string | undefined {
    const multisigAddress = this._multisigAddress || this._config.multisigAddress;
    return multisigAddress;
  }

  set multisigAddress(multisigAddress: string) {
    this._config.multisigAddress = multisigAddress;
    this._multisigAddress = multisigAddress;
  }

  get signerAddress(): string | undefined {
    return this._signerAddress;
  }

  set signerAddress(signerAddress: string) {
    this._signerAddress = signerAddress;
  }

  ///////////////////////////////////////////////
  ///// LISTENER METHODS
  public on = (event: string, listener: (...args: any[]) => void): RpcConnection => {
    this.connection.on(event, listener);
    return this.connection;
  };

  public once = (event: string, listener: (...args: any[]) => void): RpcConnection => {
    this.connection.once(event, listener);
    return this.connection;
  };

  ///////////////////////////////////////////////
  ///// SIGNING METHODS
  public signMessage = async (message: string): Promise<string> => {
    if (!this.wallet) {
      throw new Error(`Cannot sign without a wallet when using smart client`);
    }
    // will have a mnemonic, sign with wallet
    return await this.wallet.signMessage(arrayify(message));
  };

  ///////////////////////////////////////////////
  ///// STORE METHODS

  public get = async (path: string): Promise<any> => {
    if (!this.store) {
      throw new Error(
        `Should have a defined store ref when provider type is a counterfactual node.`,
      );
    }
    return await this.store.get(path);
  };

  public set = async (pairs: StorePair[], allowDelete?: Boolean): Promise<void> => {
    if (!this.store) {
      throw new Error(
        `Should have a defined store ref when provider type is a counterfactual node.`,
      );
    }
    return await this.store.set(pairs, allowDelete);
  };

  public restore = async (): Promise<StorePair[]> => {
    if (!this.store) {
      throw new Error(
        `Should have a defined store ref when provider type is a counterfactual node.`,
      );
    }
    return await this.store.restore();
  };

  public reset = async (): Promise<void> => {
    if (!this.store) {
      throw new Error(
        `Should have a defined store ref when provider type is a counterfactual node.`,
      );
    }
    return await this.store.reset();
  };

  public restoreState = async (path: string): Promise<void> => {
    this.reset();
    let state;
    state = await this.restore();
    if (!state || !state.path) {
      throw new Error(`No matching paths found in store backup's state`);
    }
    state = state.path;
    return state;
  };

  // tslint:disable-next-line: function-name
  private _send = async (
    methodName: CFCoreTypes.RpcMethodName,
    parameters: RpcParameters,
  ): Promise<any> => {
    const ret = await this.connection.rpcRouter.dispatch({
      id: Date.now(),
      methodName,
      parameters,
    });
    const result = ret.result.result;
    return result;
  };
}
