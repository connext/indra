import { Wallet } from "ethers";
import { arrayify, BigNumber } from "ethers/utils";
import { RpcParameters } from "rpc-server";

import { withdrawalKey } from "./lib";
import {
  AppActionBigNumber,
  AppStateBigNumber,
  CFCoreTypes,
  ChannelProviderConfig,
  makeChecksum,
  makeChecksumOrEthAddress,
  RpcConnection,
  RpcType,
  Store,
} from "./types";

export class ChannelRouter {
  private type: RpcType;
  private connection: RpcConnection;

  // TODO: replace this when signing keys are added!
  // shouldnt really ever be used
  private wallet: Wallet | undefined;
  private _config: ChannelProviderConfig;
  private _multisigAddress: string | undefined = undefined;
  private _signerAddress: string | undefined = undefined;
  private store: Store | undefined;
  private approvedStorePaths: string[];

  constructor(
    connection: RpcConnection,
    config: ChannelProviderConfig,
    store?: Store,
    authKey?: any,
  ) {
    this.type = config.type;
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
        return await this._send("chan_node_auth" as any, { message });

      default:
        throw new Error(`Unrecognized RpcType: ${this.type}. (How'd you even get this far tho...)`);
    }
  };

  ///////////////////////////////////////////////
  ///// CHANNEL METHODS

  public deposit = async (
    amount: BigNumber,
    assetId: string,
    multisigAddress: string,
    notifyCounterparty: boolean = false,
  ): Promise<CFCoreTypes.DepositResult> => {
    return await this._send(CFCoreTypes.RpcMethodName.DEPOSIT, {
      amount,
      multisigAddress,
      notifyCounterparty,
      tokenAddress: makeChecksum(assetId),
    } as CFCoreTypes.DepositParams);
  };

  public getStateChannel = async (): Promise<{ data: any }> => {
    return await this._send("chan_getStateChannel" as any, {
      multisigAddress: this.multisigAddress,
    });
  };

  public getState = async (appInstanceId: string): Promise<CFCoreTypes.GetStateResult> => {
    return await this._send(CFCoreTypes.RpcMethodName.GET_STATE, {
      appInstanceId,
    } as CFCoreTypes.GetStateParams);
  };

  public getAppInstances = async (): Promise<CFCoreTypes.GetAppInstancesResult> => {
    return await this._send(
      CFCoreTypes.RpcMethodName.GET_APP_INSTANCES,
      {} as CFCoreTypes.GetAppInstancesParams,
    );
  };

  public getFreeBalance = async (
    assetId: string,
    multisigAddress: string,
  ): Promise<CFCoreTypes.GetFreeBalanceStateResult> => {
    return await this._send(CFCoreTypes.RpcMethodName.GET_FREE_BALANCE_STATE, {
      multisigAddress,
      tokenAddress: makeChecksum(assetId),
    } as CFCoreTypes.GetFreeBalanceStateParams);
  };

  public getProposedAppInstances = async (): Promise<
    CFCoreTypes.GetProposedAppInstancesResult | undefined
  > => {
    return await this._send(
      CFCoreTypes.RpcMethodName.GET_PROPOSED_APP_INSTANCES,
      {} as CFCoreTypes.GetProposedAppInstancesParams,
    );
  };

  public getProposedAppInstance = async (
    appInstanceId: string,
  ): Promise<CFCoreTypes.GetProposedAppInstanceResult | undefined> => {
    return await this._send(CFCoreTypes.RpcMethodName.GET_PROPOSED_APP_INSTANCES, {
      appInstanceId,
    } as CFCoreTypes.GetProposedAppInstanceParams);
  };

  public getAppInstanceDetails = async (
    appInstanceId: string,
  ): Promise<CFCoreTypes.GetAppInstanceDetailsResult | undefined> => {
    return await this._send(CFCoreTypes.RpcMethodName.GET_APP_INSTANCE_DETAILS, {
      appInstanceId,
    } as CFCoreTypes.GetAppInstanceDetailsParams);
  };

  public getAppState = async (
    appInstanceId: string,
  ): Promise<CFCoreTypes.GetStateResult | undefined> => {
    return await this._send(CFCoreTypes.RpcMethodName.GET_STATE, {
      appInstanceId,
    } as CFCoreTypes.GetStateParams);
  };

  public takeAction = async (
    appInstanceId: string,
    action: AppActionBigNumber,
  ): Promise<CFCoreTypes.TakeActionResult> => {
    return await this._send(CFCoreTypes.RpcMethodName.TAKE_ACTION, {
      action,
      appInstanceId,
    } as CFCoreTypes.TakeActionParams);
  };

  public updateState = async (
    appInstanceId: string,
    newState: AppStateBigNumber | any,
    // cast to any bc no supported apps use
    // the update state method
  ): Promise<CFCoreTypes.UpdateStateResult> => {
    return await this._send(CFCoreTypes.RpcMethodName.UPDATE_STATE, {
      appInstanceId,
      newState,
    } as CFCoreTypes.UpdateStateParams);
  };

  public proposeInstallApp = async (
    params: CFCoreTypes.ProposeInstallParams, // TODO THIS HAS TO CHANGE
  ): Promise<CFCoreTypes.ProposeInstallResult> => {
    return await this._send(
      CFCoreTypes.RpcMethodName.PROPOSE_INSTALL,
      params as CFCoreTypes.ProposeInstallParams,
    );
  };

  public installVirtualApp = async (
    appInstanceId: string,
    intermediaryIdentifier: string,
  ): Promise<CFCoreTypes.InstallVirtualResult> => {
    return await this._send(CFCoreTypes.RpcMethodName.INSTALL_VIRTUAL, {
      appInstanceId,
      intermediaryIdentifier,
    } as CFCoreTypes.InstallVirtualParams);
  };

  public installApp = async (appInstanceId: string): Promise<CFCoreTypes.InstallResult> => {
    return await this._send(CFCoreTypes.RpcMethodName.INSTALL, {
      appInstanceId,
    } as CFCoreTypes.InstallParams);
  };

  public requestDepositRights = async (
    assetId: string,
  ): Promise<CFCoreTypes.RequestDepositRightsResult> => {
    return await this._send(CFCoreTypes.RpcMethodName.REQUEST_DEPOSIT_RIGHTS, {
      multisigAddress: this.multisigAddress,
      tokenAddress: assetId,
    } as CFCoreTypes.RequestDepositRightsParams);
  };

  public uninstallApp = async (appInstanceId: string): Promise<CFCoreTypes.UninstallResult> => {
    return await this._send(CFCoreTypes.RpcMethodName.UNINSTALL, {
      appInstanceId,
    } as CFCoreTypes.UninstallParams);
  };

  public rescindDepositRights = async (assetId: string): Promise<CFCoreTypes.DepositResult> => {
    return await this._send(CFCoreTypes.RpcMethodName.RESCIND_DEPOSIT_RIGHTS, {
      multisigAddress: this.multisigAddress,
      tokenAddress: assetId,
    } as CFCoreTypes.RescindDepositRightsParams);
  };

  public uninstallVirtualApp = async (
    appInstanceId: string,
    intermediary: string, // should be string array
  ): Promise<CFCoreTypes.UninstallVirtualResult> => {
    return await this._send(CFCoreTypes.RpcMethodName.UNINSTALL_VIRTUAL, {
      appInstanceId,
      intermediaryIdentifier: intermediary,
    } as CFCoreTypes.UninstallVirtualParams);
  };

  public rejectInstallApp = async (appInstanceId: string): Promise<CFCoreTypes.UninstallResult> => {
    return await this._send(CFCoreTypes.RpcMethodName.REJECT_INSTALL, { appInstanceId });
  };

  public withdraw = async (
    amount: BigNumber,
    assetId: string, // optional in cf
    recipient: string, // optional in cf
  ): Promise<CFCoreTypes.WithdrawResult> => {
    return await this._send(CFCoreTypes.RpcMethodName.WITHDRAW, {
      amount,
      multisigAddress: this.multisigAddress,
      recipient,
      tokenAddress: makeChecksum(assetId),
    } as CFCoreTypes.WithdrawParams);
  };

  public withdrawCommitment = async (
    amount: BigNumber,
    assetId?: string,
    recipient?: string,
  ): Promise<CFCoreTypes.WithdrawCommitmentResult> => {
    return await this._send(CFCoreTypes.RpcMethodName.WITHDRAW_COMMITMENT, {
      amount,
      multisigAddress: this.multisigAddress,
      recipient,
      tokenAddress: makeChecksumOrEthAddress(assetId),
    } as CFCoreTypes.WithdrawCommitmentParams);
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
        return await this.connection._send("chan_store_get", {
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
        return await this.connection._send("chan_store_set", {
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
