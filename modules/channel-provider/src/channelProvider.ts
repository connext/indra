import {
  chan_config,
  chan_nodeAuth,
  chan_restoreState,
  chan_storeGet,
  chan_storeSet,
  ChannelProviderConfig,
  ChannelProviderRpcMethod,
  ConnextEventEmitter,
  IChannelProvider,
  IRpcConnection,
  JsonRpcRequest,
  StorePair,
} from "@connext/types";

export class ChannelProvider extends ConnextEventEmitter implements IChannelProvider {
  public connected: boolean = false;
  public connection: IRpcConnection;

  private _config: ChannelProviderConfig | undefined = undefined;
  private _multisigAddress: string | undefined = undefined;

  constructor(connection: IRpcConnection, config?: ChannelProviderConfig) {
    super();
    this.connection = connection;
    this._config = config;
  }

  public enable(): Promise<ChannelProviderConfig> {
    return new Promise(
      async (resolve, reject): Promise<void> => {
        await this.connection.open();
        const config = this._config || (await this._send(chan_config));
        if (Object.keys(config).length > 0) {
          this.connected = true;
          this._config = config;
          this._multisigAddress = config.multisigAddress;
          this.emit("connect");
          resolve(config);
        } else {
          const err: any = new Error("User Denied Channel Config");
          err.code = 4001;
          this.connected = false;
          await this.connection.close();
          reject(err);
        }
      },
    );
  }

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

  public async close(): Promise<void> {
    await this.connection.close();
    this.connected = false;
  }

  /// ///////////////
  /// // GETTERS / SETTERS
  get isSigner(): boolean {
    return false;
  }

  get config(): ChannelProviderConfig | undefined {
    return this._config;
  }

  get multisigAddress(): string | undefined {
    const multisigAddress =
      this._multisigAddress || (this._config ? this._config.multisigAddress : undefined);
    return multisigAddress;
  }

  set multisigAddress(multisigAddress: string | undefined) {
    if (this._config) {
      this._config.multisigAddress = multisigAddress;
    }
    this._multisigAddress = multisigAddress;
  }

  get signerAddress(): string | undefined {
    return this.config.signerAddress;
  }

  set signerAddress(signerAddress: string | undefined) {
    this.config.signerAddress = signerAddress;
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

  /// ////////////////////////////////////////////
  /// // SIGNING METHODS

  public signMessage = async (message: string): Promise<string> => {
    return this._send(chan_nodeAuth, { message });
  };

  /// ////////////////////////////////////////////
  /// // STORE METHODS

  public get = async (path: string): Promise<any> => {
    return this._send(chan_storeGet, {
      path,
    });
  };

  public set = async (pairs: StorePair[], allowDelete?: Boolean): Promise<void> => {
    return this._send(chan_storeSet, {
      allowDelete,
      pairs,
    });
  };

  public restoreState = async (path: string): Promise<void> => {
    return this._send(chan_restoreState, { path });
  };

  /// ////////////////////////////////////////////
  /// // PRIVATE METHODS

  private async _send(method: ChannelProviderRpcMethod, params: any = {}): Promise<any> {
    const payload = { id: Date.now(), jsonrpc: "2.0", method, params };
    const result = await this.connection.send(payload as JsonRpcRequest);
    return result;
  }
}
