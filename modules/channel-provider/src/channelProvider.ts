import {
  ChannelMethod,
  ChannelMethods,
  ChannelProviderConfig,
  ConnextEventEmitter,
  IChannelProvider,
  IRpcConnection,
  JsonRpcRequest,
  StateChannelJSON,
  WithdrawalMonitorObject,
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
        const config = this._config || (await this._send(ChannelMethods.chan_config));
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

  public send = async (method: ChannelMethod, params: any = {}): Promise<any> => {
    let result;
    switch (method) {
      case ChannelMethods.chan_setUserWithdrawal:
        result = await this.setUserWithdrawal(params.withdrawalObject);
        break;
      case ChannelMethods.chan_getUserWithdrawal:
        result = await this.getUserWithdrawal();
        break;
      case ChannelMethods.chan_nodeAuth:
        result = await this.signMessage(params.message);
        break;
      case ChannelMethods.chan_config:
        result = this.config;
        break;
      case ChannelMethods.chan_restoreState:
        result = await this.restoreState();
        break;
      case ChannelMethods.chan_setStateChannel:
        result = await this.setStateChannel(params.state);
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
    return this._send(ChannelMethods.chan_nodeAuth, { message });
  };

  /// ////////////////////////////////////////////
  /// // STORE METHODS

  public getUserWithdrawal = async (): Promise<any> => {
    return this._send(ChannelMethods.chan_getUserWithdrawal, {});
  };

  public setUserWithdrawal = async (withdrawalObject: WithdrawalMonitorObject): Promise<void> => {
    return this._send(ChannelMethods.chan_setUserWithdrawal, {
      withdrawalObject,
    });
  };

  public restoreState = async (): Promise<void> => {
    return this._send(ChannelMethods.chan_restoreState, { });
  };

  public setStateChannel = async (state: StateChannelJSON): Promise<void> => {
    return this._send(ChannelMethods.chan_setStateChannel, { state });
  };

  /// ////////////////////////////////////////////
  /// // PRIVATE METHODS

  private async _send(method: ChannelMethod, params: any = {}): Promise<any> {
    const payload = { id: Date.now(), jsonrpc: "2.0", method, params };
    const result = await this.connection.send(payload as JsonRpcRequest);
    return result;
  }
}
