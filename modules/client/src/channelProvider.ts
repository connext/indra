import {
  chan_storeSet,
  chan_storeGet,
  chan_nodeAuth,
  chan_restoreState,
  IChannelProvider,
  ConnextEventEmitter,
} from "@connext/types";
import { ChannelProvider } from "@connext/channel-provider";
import { Wallet } from "ethers";

import { CFCore, deBigNumberifyJson, xpubToAddress } from "./lib";
import {
  CFChannelProviderOptions,
  CFCoreTypes,
  ChannelProviderConfig,
  IRpcConnection,
  JsonRpcRequest,
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
  logger,
}: CFChannelProviderOptions): Promise<IChannelProvider> => {
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
  const connection = new CFCoreRpcConnection(cfCore, store, await keyGen("0"));
  const channelProvider = new ChannelProvider(connection, channelProviderConfig);
  return channelProvider;
};

export class CFCoreRpcConnection extends ConnextEventEmitter implements IRpcConnection {
  public connected: boolean = true;
  public cfCore: CFCore;
  public store: Store;

  // TODO: replace this when signing keys are added!
  public wallet: Wallet;

  constructor(cfCore: CFCore, store: Store, authKey: any) {
    super();
    this.cfCore = cfCore;
    this.wallet = authKey ? new Wallet(authKey) : null;
    this.store = store;
  }

  public async send(payload: JsonRpcRequest): Promise<any> {
    const { method, params } = payload;
    let result;
    switch (method) {
      case chan_storeSet:
        result = await this.storeSet(params.pairs, params.allowDelete);
        break;
      case chan_storeGet:
        result = await this.storeGet(params.path);
        break;
      case chan_nodeAuth:
        result = await this.walletSign(params.message);
        break;
      case chan_restoreState:
        result = await this.restoreState(params.path);
        break;
      default:
        result = await this.routerDispatch(method, params);
        break;
    }
    return result;
  }

  public on = (
    event: string | CFCoreTypes.EventName | CFCoreTypes.RpcMethodName,
    listener: (...args: any[]) => void,
  ): any => {
    this.cfCore.on(event as any, listener);
    return this.cfCore;
  };

  public once = (
    event: string | CFCoreTypes.EventName | CFCoreTypes.RpcMethodName,
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

  ///////////////////////////////////////////////
  ///// PRIVATE METHODS
  private walletSign = async (message: string): Promise<string> => {
    return this.wallet.signMessage(message);
  };

  private storeGet = async (path: string): Promise<any> => {
    return this.store.get(path);
  };

  private storeSet = async (pairs: StorePair[], allowDelete?: Boolean): Promise<void> => {
    return this.store.set(pairs, allowDelete);
  };

  private storeRestore = async (): Promise<StorePair[]> => {
    return await this.store.restore();
  };

  private storeReset = async (): Promise<void> => {
    return await this.store.reset();
  };

  // TODO: clean up types from restore, without the any typing things
  // get messed up. will likely be a breaking change
  private restoreState = async (path: string): Promise<void> => {
    // TODO: remove when using only store package
    this.storeReset();
    let state;
    state = await this.storeRestore();
    if (!state || !state.path) {
      throw new Error("No matching paths found in store backup's state");
    }
    state = state.path;
    return state;
  };

  private routerDispatch = async (method: string, params: any = {}) => {
    const ret = await this.cfCore.rpcRouter.dispatch({
      id: Date.now(),
      methodName: method,
      parameters: deBigNumberifyJson(params),
    });
    return ret.result.result;
  };
}
