import {
  ChannelProviderRpcMethod,
  ChannelProviderRpcMethods,
  StateChannelJSON,
} from "@connext/types";
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
  RescindDepositRightsParameters,
  RescindDepositRightsResponse,
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
  public on = (
    event: CFCoreTypes.EventName | CFCoreTypes.RpcMethodName,
    listener: (...args: any[]) => void,
  ): RpcConnection => {
    this.connection.on(event, listener);
    return this.connection;
  };

  public once = (
    event: CFCoreTypes.EventName | CFCoreTypes.RpcMethodName,
    listener: (...args: any[]) => void,
  ): RpcConnection => {
    this.connection.once(event, listener);
    return this.connection;
  };

  ///////////////////////////////////////////////
  ///// SIGNING METHODS
  public signMessage = async (message: string): Promise<string> => {
    switch (this.type) {
      case "CounterfactualNode":
        if (!this.wallet) {
          throw new Error(`Cannot sign without a wallet when using smart client`);
        }
        // will have a mnemonic, sign with wallet
        return await this.wallet.signMessage(arrayify(message));

      case "ChannelProvider":
        return await this._send(
          ChannelProviderRpcMethods.chan_nodeAuth as ChannelProviderRpcMethod,
          { message },
        );

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
    return await this._send(
      CFCoreTypes.RpcMethodNames.chan_deposit as CFCoreTypes.RpcMethodName,
      {
        amount,
        multisigAddress,
        notifyCounterparty,
        tokenAddress: makeChecksum(assetId),
      } as CFCoreTypes.DepositParams,
    );
  };

  public getStateChannel = async (): Promise<{ data: StateChannelJSON }> => {
    return await this._send(
      CFCoreTypes.RpcMethodNames.chan_getStateChannel as CFCoreTypes.RpcMethodName,
      {
        multisigAddress: this.multisigAddress,
      },
    );
  };

  public getState = async (appInstanceId: string): Promise<CFCoreTypes.GetStateResult> => {
    return await this._send(
      CFCoreTypes.RpcMethodNames.chan_getState as CFCoreTypes.RpcMethodName,
      {
        appInstanceId,
      } as CFCoreTypes.GetStateParams,
    );
  };

  public getAppInstances = async (
    multisigAddress?: string,
  ): Promise<CFCoreTypes.GetAppInstancesResult> => {
    return await this._send(
      CFCoreTypes.RpcMethodNames.chan_getAppInstances as CFCoreTypes.RpcMethodName,
      {
        multisigAddress,
      } as CFCoreTypes.GetAppInstancesParams,
    );
  };

  public getFreeBalance = async (
    assetId: string,
    multisigAddress: string,
  ): Promise<CFCoreTypes.GetFreeBalanceStateResult> => {
    return await this._send(
      CFCoreTypes.RpcMethodNames.chan_getFreeBalanceState as CFCoreTypes.RpcMethodName,
      {
        multisigAddress,
        tokenAddress: makeChecksum(assetId),
      } as CFCoreTypes.GetFreeBalanceStateParams,
    );
  };

  public getProposedAppInstances = async (
    multisigAddress?: string,
  ): Promise<CFCoreTypes.GetProposedAppInstancesResult | undefined> => {
    return await this._send(
      CFCoreTypes.RpcMethodNames.chan_getProposedAppInstances as CFCoreTypes.RpcMethodName,
      {
        multisigAddress,
      } as CFCoreTypes.GetProposedAppInstancesParams,
    );
  };

  public getProposedAppInstance = async (
    appInstanceId: string,
  ): Promise<CFCoreTypes.GetProposedAppInstanceResult | undefined> => {
    return await this._send(
      CFCoreTypes.RpcMethodNames.chan_getProposedAppInstances as CFCoreTypes.RpcMethodName,
      {
        appInstanceId,
      } as CFCoreTypes.GetProposedAppInstanceParams,
    );
  };

  public getAppInstanceDetails = async (
    appInstanceId: string,
  ): Promise<CFCoreTypes.GetAppInstanceDetailsResult | undefined> => {
    return await this._send(
      CFCoreTypes.RpcMethodNames.chan_getAppInstance as CFCoreTypes.RpcMethodName,
      {
        appInstanceId,
      } as CFCoreTypes.GetAppInstanceDetailsParams,
    );
  };

  public getAppState = async (
    appInstanceId: string,
  ): Promise<CFCoreTypes.GetStateResult | undefined> => {
    return await this._send(
      CFCoreTypes.RpcMethodNames.chan_getState as CFCoreTypes.RpcMethodName,
      {
        appInstanceId,
      } as CFCoreTypes.GetStateParams,
    );
  };

  public takeAction = async (
    appInstanceId: string,
    action: AppActionBigNumber,
  ): Promise<CFCoreTypes.TakeActionResult> => {
    return await this._send(
      CFCoreTypes.RpcMethodNames.chan_takeAction as CFCoreTypes.RpcMethodName,
      {
        action,
        appInstanceId,
      } as CFCoreTypes.TakeActionParams,
    );
  };

  public updateState = async (
    appInstanceId: string,
    newState: AppStateBigNumber | any,
    // cast to any bc no supported apps use
    // the update state method
  ): Promise<CFCoreTypes.UpdateStateResult> => {
    return await this._send(
      CFCoreTypes.RpcMethodNames.chan_updateState as CFCoreTypes.RpcMethodName,
      {
        appInstanceId,
        newState,
      } as CFCoreTypes.UpdateStateParams,
    );
  };

  public proposeInstallApp = async (
    params: CFCoreTypes.ProposeInstallParams, // TODO THIS HAS TO CHANGE
  ): Promise<CFCoreTypes.ProposeInstallResult> => {
    return await this._send(
      CFCoreTypes.RpcMethodNames.chan_proposeInstall as CFCoreTypes.RpcMethodName,
      params as CFCoreTypes.ProposeInstallParams,
    );
  };

  public installVirtualApp = async (
    appInstanceId: string,
    intermediaryIdentifier: string,
  ): Promise<CFCoreTypes.InstallVirtualResult> => {
    return await this._send(
      CFCoreTypes.RpcMethodNames.chan_installVirtual as CFCoreTypes.RpcMethodName,
      {
        appInstanceId,
        intermediaryIdentifier,
      } as CFCoreTypes.InstallVirtualParams,
    );
  };

  public installApp = async (appInstanceId: string): Promise<CFCoreTypes.InstallResult> => {
    return await this._send(
      CFCoreTypes.RpcMethodNames.chan_install as CFCoreTypes.RpcMethodName,
      {
        appInstanceId,
      } as CFCoreTypes.InstallParams,
    );
  };

  public requestDepositRights = async (
    assetId: string,
  ): Promise<CFCoreTypes.RequestDepositRightsResult> => {
    return await this._send(
      CFCoreTypes.RpcMethodNames.chan_requestDepositRights as CFCoreTypes.RpcMethodName,
      {
        multisigAddress: this.multisigAddress,
        tokenAddress: assetId,
      } as CFCoreTypes.RequestDepositRightsParams,
    );
  };

  public uninstallApp = async (appInstanceId: string): Promise<CFCoreTypes.UninstallResult> => {
    return await this._send(
      CFCoreTypes.RpcMethodNames.chan_uninstall as CFCoreTypes.RpcMethodName,
      {
        appInstanceId,
      } as CFCoreTypes.UninstallParams,
    );
  };

  public rescindDepositRights = async (
    params: RescindDepositRightsParameters,
  ): Promise<RescindDepositRightsResponse> => {
    return await this._send(
      CFCoreTypes.RpcMethodNames.chan_rescindDepositRights as CFCoreTypes.RpcMethodName,
      {
        multisigAddress: this.multisigAddress,
        tokenAddress: params.assetId,
      } as CFCoreTypes.RescindDepositRightsParams,
    );
  };

  public uninstallVirtualApp = async (
    appInstanceId: string,
    intermediary: string, // should be string array
  ): Promise<CFCoreTypes.UninstallVirtualResult> => {
    return await this._send(
      CFCoreTypes.RpcMethodNames.chan_uninstallVirtual as CFCoreTypes.RpcMethodName,
      {
        appInstanceId,
        intermediaryIdentifier: intermediary,
      } as CFCoreTypes.UninstallVirtualParams,
    );
  };

  public rejectInstallApp = async (appInstanceId: string): Promise<CFCoreTypes.UninstallResult> => {
    return await this._send(
      CFCoreTypes.RpcMethodNames.chan_rejectInstall as CFCoreTypes.RpcMethodName,
      { appInstanceId },
    );
  };

  public withdraw = async (
    amount: BigNumber,
    assetId: string, // optional in cf
    recipient: string, // optional in cf
  ): Promise<CFCoreTypes.WithdrawResult> => {
    return await this._send(
      CFCoreTypes.RpcMethodNames.chan_withdraw as CFCoreTypes.RpcMethodName,
      {
        amount,
        multisigAddress: this.multisigAddress,
        recipient,
        tokenAddress: makeChecksum(assetId),
      } as CFCoreTypes.WithdrawParams,
    );
  };

  public withdrawCommitment = async (
    amount: BigNumber,
    assetId?: string,
    recipient?: string,
  ): Promise<CFCoreTypes.WithdrawCommitmentResult> => {
    return await this._send(
      CFCoreTypes.RpcMethodNames.chan_withdrawCommitment as CFCoreTypes.RpcMethodName,
      {
        amount,
        multisigAddress: this.multisigAddress,
        recipient,
        tokenAddress: makeChecksumOrEthAddress(assetId),
      } as CFCoreTypes.WithdrawCommitmentParams,
    );
  };

  ///////////////////////////////////////////////
  ///// STORE METHODS

  public get = async (path: string): Promise<any> => {
    this.isApprovedGetSetPath(path);
    switch (this.type) {
      case "CounterfactualNode":
        if (!this.store) {
          throw new Error(
            `Should have a defined store ref when provider type is a counterfactual node.`,
          );
        }
        return await this.store.get(path);

      case "ChannelProvider":
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
      case "CounterfactualNode":
        if (!this.store) {
          throw new Error(
            `Should have a defined store ref when provider type is a counterfactual node.`,
          );
        }
        return await this.store.set(pairs, allowDelete);

      case "ChannelProvider":
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
      case "CounterfactualNode":
        if (!this.store) {
          throw new Error(
            `Should have a defined store ref when provider type is a counterfactual node.`,
          );
        }
        return await this.store.restore();

      case "ChannelProvider":
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
      case "CounterfactualNode":
        if (!this.store) {
          throw new Error(
            `Should have a defined store ref when provider type is a counterfactual node.`,
          );
        }
        return await this.store.reset();

      case "ChannelProvider":
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
    if (this.type === "CounterfactualNode") {
      return;
    }

    // verify it is in the approved paths for editing
    if (this.approvedStorePaths.indexOf(path) === -1) {
      throw new Error(`Not an approved store path to get/set: ${path}`);
    }
  }

  // tslint:disable-next-line: function-name
  private async _send(
    methodName: ChannelProviderRpcMethod,
    parameters: RpcParameters,
  ): Promise<any> {
    let result: any;
    switch (this.type) {
      case "CounterfactualNode":
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

      case "ChannelProvider":
        result = await this.connection._send(methodName, parameters);
        break;

      default:
        throw new Error(`Unknown rpc type: ${this.type}`);
    }
    return result;
  }
}
