import {
  ChannelMethods,
  ChannelProviderConfig,
  ConnextEventEmitter,
  IChannelProvider,
  IRpcConnection,
  JsonRpcRequest,
  StateChannelJSON,
  WithdrawalMonitorObject,
  WalletDepositParams,
  MinimalTransaction,
  SetStateCommitmentJSON,
  ConditionalTransactionCommitmentJSON,
} from "@connext/types";

export class ChannelProvider extends ConnextEventEmitter implements IChannelProvider {
  public connected: boolean = false;
  public connection: IRpcConnection;

  private _config: ChannelProviderConfig | undefined;
  private _multisigAddress: string | undefined;

  constructor(connection: IRpcConnection) {
    super();
    this.connection = connection;
  }

  public enable(): Promise<ChannelProviderConfig> {
    return new Promise(
      async (resolve, reject): Promise<void> => {
        await this.connection.open();
        let config;
        try {
          config = await this._send(ChannelMethods.chan_enable);
        } catch (e) {
          return reject(`Could not enable channel: ${e.message}`);
        }
        if (Object.keys(config).length > 0) {
          this.connected = true;
          this._config = config;
          this._multisigAddress = config.multisigAddress;
          this.emit("connect");
          return resolve(config);
        } else {
          const err: any = new Error("User Denied Channel Config");
          err.code = 4001;
          this.connected = false;
          await this.connection.close();
          return reject(err);
        }
      },
    );
  }

  public send = async (method: ChannelMethods, params: any = {}): Promise<any> => {
    let result;
    switch (method) {
      case ChannelMethods.chan_setUserWithdrawal:
        result = await this.setUserWithdrawal(params.withdrawalObject, params.remove);
        break;
      case ChannelMethods.chan_getUserWithdrawal:
        result = await this.getUserWithdrawals();
        break;
      case ChannelMethods.chan_signMessage:
        result = await this.signMessage(params.message);
        break;
      case ChannelMethods.chan_encrypt:
        result = await this.encrypt(params.message, params.publicIdentifier);
        break;
      case ChannelMethods.chan_decrypt:
        result = await this.decrypt(params.encryptedPreImage);
        break;
      case ChannelMethods.chan_restoreState:
        result = await this.restoreState();
        break;
      case ChannelMethods.chan_setStateChannel:
        result = await this.setStateChannel(
          params.state,
          params.setupCommitment,
          params.setStateCommitments,
          params.conditionalCommitments,
        );
        break;
      case ChannelMethods.chan_walletDeposit:
        result = await this.walletDeposit(params);
        break;
      case ChannelMethods.chan_getSchemaVersion:
        result = await this.getSchemaVersion();
        break;
      case ChannelMethods.chan_updateSchemaVersion:
        result = await this.updateSchemaVersion(params.version);
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
  get config(): ChannelProviderConfig | undefined {
    return this._config;
  }

  get multisigAddress(): string | undefined {
    const multisigAddress =
      this._multisigAddress ||
      (typeof this._config !== "undefined" ? this._config.multisigAddress : undefined);
    return multisigAddress;
  }

  set multisigAddress(multisigAddress: string | undefined) {
    if (typeof this._config !== "undefined") {
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
  public isSigner() {
    return this._send(ChannelMethods.chan_isSigner);
  }

  public signMessage(message: string): Promise<string> {
    return this._send(ChannelMethods.chan_signMessage, { message });
  }

  public encrypt(message: string, publicIdentifier: string): Promise<string> {
    return this._send(ChannelMethods.chan_encrypt, {
      message,
      publicIdentifier,
    });
  }

  public decrypt(encryptedPreImage: string): Promise<string> {
    return this._send(ChannelMethods.chan_decrypt, {
      encryptedPreImage,
    });
  }

  public walletDeposit = async (params: WalletDepositParams) => {
    return this._send(ChannelMethods.chan_walletDeposit, params);
  };

  /// ////////////////////////////////////////////
  /// // STORE METHODS

  public getUserWithdrawals = async (): Promise<WithdrawalMonitorObject[]> => {
    return this._send(ChannelMethods.chan_getUserWithdrawal, {});
  };

  public setUserWithdrawal = async (
    withdrawalObject: WithdrawalMonitorObject,
    remove: boolean = false,
  ): Promise<void> => {
    return this._send(ChannelMethods.chan_setUserWithdrawal, {
      withdrawalObject,
      remove,
    });
  };

  public restoreState = async (): Promise<void> => {
    return this._send(ChannelMethods.chan_restoreState, {});
  };

  public setStateChannel = async (
    state: StateChannelJSON,
    setupCommitment: MinimalTransaction,
    setStateCommitments: [string, SetStateCommitmentJSON][], // [appId, json]
    conditionalCommitments: [string, ConditionalTransactionCommitmentJSON][],
    // [appId, json]
  ): Promise<void> => {
    return this._send(ChannelMethods.chan_setStateChannel, {
      state,
      setupCommitment,
      setStateCommitments,
      conditionalCommitments,
    });
  };

  public getSchemaVersion(): Promise<number> {
    return this._send(ChannelMethods.chan_getSchemaVersion);
  }

  public updateSchemaVersion(version?: number): Promise<void> {
    return this._send(ChannelMethods.chan_updateSchemaVersion, { version });
  }

  /// ////////////////////////////////////////////
  /// // PRIVATE METHODS

  private async _send(method: ChannelMethods, params: any = {}): Promise<any> {
    const payload = { id: Date.now(), jsonrpc: "2.0", method, params };
    const result = await this.connection.send(payload as JsonRpcRequest);
    return result;
  }
}
