import { Wallet } from "ethers";
import { arrayify } from "ethers/utils";
import EventEmitter from "events";
import { RpcParameters } from "rpc-server";

import { CFCore, deBigNumberifyJson, xpubToAddress } from "./lib";
import {
  CFChannelProviderOptions,
  CFCoreTypes,
  ChannelProviderConfig,
  ChannelProviderRpcMethod,
  IChannelProvider,
  IRpcConnection,
  JsonRpcRequest,
  Store,
  StorePair,
} from "./types";
import {
  chan_storeSet,
  chan_storeGet,
  chan_nodeAuth,
  chan_config,
  chan_restoreState,
} from "@connext/types";

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
  const connection = new RpcConnection(cfCore);
  const channelProvider = new ChannelProvider(
    connection,
    channelProviderConfig,
    store,
    await keyGen(`0`),
  );
  return channelProvider;
};

export class RpcConnection extends EventEmitter implements IRpcConnection {
  public connected: boolean = true;
  public cfCore: CFCore;

  constructor(cfCore: CFCore) {
    super();
    this.cfCore = cfCore;
  }

  public async send(payload: JsonRpcRequest): Promise<any> {
    const ret = await this.cfCore.rpcRouter.dispatch({
      id: Date.now(),
      methodName: payload.method,
      parameters: deBigNumberifyJson(payload.params),
    });
    const result = ret.result.result;
    return result;
  }

  public on = (
    event: CFCoreTypes.EventName | CFCoreTypes.RpcMethodName,
    listener: (...args: any[]) => void,
  ): any => {
    this.cfCore.on(event as any, listener);
    return this.cfCore;
  };

  public once = (
    event: CFCoreTypes.EventName | CFCoreTypes.RpcMethodName,
    listener: (...args: any[]) => void,
  ): any => {
    this.cfCore.once(event as any, listener);
    return this.cfCore;
  };

  public open(): Promise<void> {
    return Promise.resolve();
  }

  public close(): Promise<void> {
    return Promise.resolve();
  }
}

export class ChannelProvider extends EventEmitter implements IChannelProvider {
  public connected: boolean = true;
  public connection: IRpcConnection;
  public store: Store;

  // TODO: replace this when signing keys are added!
  public wallet: Wallet;

  // shouldnt really ever be used
  private _config: ChannelProviderConfig;
  private _multisigAddress: string | undefined = undefined;
  private _signerAddress: string | undefined = undefined;

  constructor(
    connection: IRpcConnection,
    config: ChannelProviderConfig,
    store: Store,
    authKey: any,
  ) {
    super();
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

  public send = async (method: ChannelProviderRpcMethod, params: any = {}): Promise<any> => {
    let result;
    switch (method) {
    case chan_storeSet:
      result = await this.set(params.pairs);
      break;
    case chan_storeGet:
      result = await this.get(params.path);
      break;
    case chan_nodeAuth:
      result = await this.signMessage(params.message);
      break;
    case chan_config:
      result = this.config;
      break;
    case chan_restoreState:
      result = await this.restoreState(params.path);
      break;
    default:
      result = await this._send(method, params);
      break;
    }
    return result;
  };

  public close(): Promise<void> {
    return Promise.resolve();
  }

  ///////////////////////////////////////////////
  ///// GETTERS / SETTERS
  get isSigner(): boolean {
    return true;
  }

  get config(): ChannelProviderConfig {
    return this._config;
  }

  get multisigAddress(): string | undefined {
    return this._multisigAddress || this.config.multisigAddress;
  }

  set multisigAddress(multisigAddress: string) {
    this._config.multisigAddress = multisigAddress;
    this._multisigAddress = multisigAddress;
  }

  get signerAddress(): string {
    return this._signerAddress || this.config.signerAddress;
  }

  set signerAddress(signerAddress: string) {
    this._config.signerAddress = signerAddress;
    this._signerAddress = signerAddress;
  }

  ///////////////////////////////////////////////
  ///// LISTENER METHODS
  public on = (event: string, listener: (...args: any[]) => void): any => {
    this.connection.on(event, listener);
    return this.connection;
  };

  public once = (event: string, listener: (...args: any[]) => void): any => {
    this.connection.once(event, listener);
    return this.connection;
  };

  ///////////////////////////////////////////////
  ///// SIGNING METHODS
  public signMessage = async (message: string): Promise<string> => {
    return await this.wallet.signMessage(arrayify(message));
  };

  ///////////////////////////////////////////////
  ///// STORE METHODS

  public get = async (path: string): Promise<any> => {
    return await this.store.get(path);
  };

  public set = async (pairs: StorePair[], allowDelete?: Boolean): Promise<void> => {
    return await this.store.set(pairs, allowDelete);
  };

  public restore = async (): Promise<StorePair[]> => {
    return await this.store.restore();
  };

  public reset = async (): Promise<void> => {
    return await this.store.reset();
  };

  // TODO: clean up types from restore, without the any typing things
  // get messed up. will likely be a breaking change
  public restoreState = async (path: string): Promise<void> => {
    // TODO: remove when using only store package
    this.reset();
    let state;
    state = await this.restore();
    if (!state || !state.path) {
      throw new Error(`No matching paths found in store backup's state`);
    }
    state = state.path;
    return state;
  };

  ///////////////////////////////////////////////
  ///// PRIVATE METHODS

  private _send = async (method: ChannelProviderRpcMethod, params: RpcParameters): Promise<any> => {
    const payload = {
      id: Date.now(),
      jsonrpc: `2.0`,
      method,
      params,
    };
    const result = await this.connection.send(payload as JsonRpcRequest);
    return result;
  };
}
