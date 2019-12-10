import { Wallet } from "ethers";
import { arrayify } from "ethers/utils";
import { RpcParameters } from "rpc-server";

import { withdrawalKey } from "./lib";
import {
  CFCoreTypes,
  ChannelProviderConfig,
  NewRpcMethodName,
  RpcConnection,
  RpcType,
  Store,
} from "./types";

export class ChannelProvider {
  private type: RpcType;
  private connection: RpcConnection;

  // TODO: replace this when signing keys are added!
  // shouldnt really ever be used
  private wallet: Wallet | undefined;
  private _config: ChannelProviderConfig; // tslint:disable-line: variable-name
  private _multisigAddress: string | undefined = undefined; // tslint:disable-line: variable-name
  private _signerAddress: string | undefined = undefined; // tslint:disable-line: variable-name
  private store: Store | undefined;
  private approvedStorePaths: string[];

  constructor(
    connection: RpcConnection,
    config: ChannelProviderConfig,
    store?: Store,
    authKey?: any,
  ) {
    this.store = store;
    this.wallet = authKey ? new Wallet(authKey) : null;
    this.connection = connection;
    this._config = config;
    this._multisigAddress = config.multisigAddress;
    this._signerAddress = config.signerAddress;
    this.approvedStorePaths = [
      // allow the withdrawal setting to happen
      withdrawalKey(this.config.userPublicIdentifier),
    ];
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
    return this._multisigAddress;
  }

  set multisigAddress(multisigAddress: string) {
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
    switch (this.type) {
      case RpcType.CounterfactualNode:
        if (!this.wallet) {
          throw new Error(`Cannot sign without a wallet when using smart client`);
        }
        // will have a mnemonic, sign with wallet
        return await this.wallet.signMessage(arrayify(message));

      case RpcType.ChannelProvider:
        return await this._send(NewRpcMethodName.NODE_AUTH as any, { message });

      default:
        throw new Error(`Unrecognized RpcType: ${this.type}. (How'd you even get this far tho...)`);
    }
  };

  ///////////////////////////////////////////////
  ///// STORE METHODS

  public get = async (path: string): Promise<any> => {
    this.isApprovedGetSetPath(path);
    switch (this.type) {
      case RpcType.CounterfactualNode:
        if (!this.store) {
          throw new Error(
            `Should have a defined store ref when provider type is a counterfactual node.`,
          );
        }
        return await this.store.get(path);

      case RpcType.ChannelProvider:
        // route the store get call through the connection
        return await this.connection._send(NewRpcMethodName.STORE_GET, {
          path,
        });

      default:
        throw new Error(`Unrecognized RpcType: ${this.type}. (How'd you even get this far tho...)`);
    }
  };

  public set = async (
    pairs: {
      path: string;
      value: any;
    }[],
    allowDelete?: Boolean,
  ): Promise<void> => {
    // verify it is in the approved paths for editing
    pairs.forEach(({ path, value }) => {
      this.isApprovedGetSetPath(path);
    });
    switch (this.type) {
      case RpcType.CounterfactualNode:
        if (!this.store) {
          throw new Error(
            `Should have a defined store ref when provider type is a counterfactual node.`,
          );
        }
        return await this.store.set(pairs, allowDelete);

      case RpcType.ChannelProvider:
        // route the store get call through the connection
        return await this.connection._send(NewRpcMethodName.STORE_SET, {
          allowDelete,
          pairs,
        });

      default:
        throw new Error(`Unrecognized RpcType: ${this.type}. (How'd you even get this far tho...)`);
    }
  };

  public restore = async (): Promise<{ path: string; value: any }[]> => {
    switch (this.type) {
      case RpcType.CounterfactualNode:
        if (!this.store) {
          throw new Error(
            `Should have a defined store ref when provider type is a counterfactual node.`,
          );
        }
        return await this.store.restore();

      case RpcType.ChannelProvider:
        // do not allow channel provider types to restore state
        // TODO: can we route to the smart client here?
        throw new Error(
          `Cannot restore store with channel provider instantiation. Please contact original wallet provider.`,
        );
      default:
        throw new Error(`Unrecognized RpcType: ${this.type}. (How'd you even get this far tho...)`);
    }
  };

  public reset = async (): Promise<void> => {
    switch (this.type) {
      case RpcType.CounterfactualNode:
        if (!this.store) {
          throw new Error(
            `Should have a defined store ref when provider type is a counterfactual node.`,
          );
        }
        return await this.store.reset();

      case RpcType.ChannelProvider:
        // do not allow channel provider types to reset store
        throw new Error(
          `Cannot restore store with channel provider instantiation. Please contact original wallet provider.`,
        );
      default:
        throw new Error(`Unrecognized RpcType: ${this.type}. (How'd you even get this far tho...)`);
    }
  };

  public restoreState = async (path: string): Promise<void> => {
    switch (this.type) {
      case RpcType.CounterfactualNode:
        this.reset();
        let state;
        state = await this.restore();
        if (!state || !state.path) {
          throw new Error(`No matching paths found in store backup's state`);
        }
        state = state.path;
        return state;

      case RpcType.ChannelProvider:
        // do not allow channel provider types to reset store
        return await this.connection._send(NewRpcMethodName.RESTORE_STATE, { path });
      default:
        throw new Error(`Unrecognized RpcType: ${this.type}. (How'd you even get this far tho...)`);
    }
  };

  ///////////////////////////////////////////////
  ///// PRIVATE METHODS

  private isApprovedGetSetPath(path: string): void {
    // if it is a smart client, all paths are approved
    if (this.type === RpcType.CounterfactualNode) {
      return;
    }

    // verify it is in the approved paths for editing
    if (this.approvedStorePaths.indexOf(path) === -1) {
      throw new Error(`Not an approved store path to get/set: ${path}`);
    }
  }

  // tslint:disable-next-line: function-name
  private async _send(
    methodName: CFCoreTypes.RpcMethodName,
    parameters: RpcParameters,
  ): Promise<any> {
    let result: any;
    switch (this.type) {
      case RpcType.CounterfactualNode:
        const ret = await this.connection.rpcRouter.dispatch({
          id: Date.now(),
          methodName,
          parameters,
        });
        // cf module nests the return value in a `.result.result`
        // should make sure that the channel provider call
        // does not
        result = ret.result.result;
        break;

      case RpcType.ChannelProvider:
        result = await this.connection._send(methodName, parameters);
        break;

      default:
        throw new Error(`Unknown rpc type: ${this.type}`);
    }
    return result;
  }
}
