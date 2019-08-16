import {
  AppActionBigNumber,
  AppStateBigNumber,
  ChannelProvider,
  makeChecksum,
} from "@connext/types";
import { Node } from "@counterfactual/node";
import { Node as NodeTypes } from "@counterfactual/types";
import { BigNumber } from "ethers/utils";
import { EventEmitter } from "events";
import { RpcParameters } from "rpc-server";

export enum RpcType {
  ChannelProvider = "ChannelProvider",
  CounterfactualNode = "CounterfactualNode", // rename?
}

// TODO: properly `ChannelProvider` define type
export type RpcConnection = Node | ChannelProvider;
export class ChannelRouter extends EventEmitter {
  private type: RpcType;
  private connection: RpcConnection;

  // FIXME: the channel provider should have these static properties
  // easily accessible somehow
  public freeBalanceAddress: string;
  public publicIdentifier: string;
  // TODO: should we add in the multisig address here as well?

  constructor(type: RpcType, connection: RpcConnection) {
    super();
    this.type = type;
    this.connection = connection;

    // should be the 0th key along the channel path
    this.freeBalanceAddress = connection.freeBalanceAddress;
    // the xpub of user
    this.publicIdentifier = connection.publicIdentifier;

    // TODO: what is conditionally set in the class here?
    // if (type === RpcType.ChannelProvider) {
    // } else if (type === RpcType.Rpc) {
    // }
  }

  ///////////////////////////////////////////////
  ///// PROVIDER METHODS

  public deposit = async (
    amount: BigNumber,
    assetId: string,
    multisigAddress: string,
    notifyCounterparty: boolean = false,
  ): Promise<NodeTypes.DepositResult> => {
    return await this._send(NodeTypes.RpcMethodName.DEPOSIT, {
      amount,
      assetId: makeChecksum(assetId),
      multisigAddress,
      notifyCounterparty,
    });
  };

  public getAppInstances = async (): Promise<NodeTypes.GetAppInstancesResult> => {
    return await this._send(NodeTypes.RpcMethodName.GET_APP_INSTANCES, {});
  };

  public getFreeBalance = async (
    assetId: string,
    multisigAddress: string,
  ): Promise<NodeTypes.GetFreeBalanceStateResult> => {
    return await this._send(NodeTypes.RpcMethodName.GET_FREE_BALANCE_STATE, {
      assetId: makeChecksum(assetId),
      multisigAddress,
    });
  };

  public getProposedAppInstances = async (): Promise<
    NodeTypes.GetProposedAppInstancesResult | undefined
  > => {
    return await this._send(NodeTypes.RpcMethodName.GET_PROPOSED_APP_INSTANCES, {});
  };

  public getProposedAppInstance = async (
    appInstanceId: string,
  ): Promise<NodeTypes.GetProposedAppInstanceResult | undefined> => {
    return await this._send(NodeTypes.RpcMethodName.GET_PROPOSED_APP_INSTANCES, {
      appInstanceId,
    });
  };

  public getAppInstanceDetails = async (
    appInstanceId: string,
  ): Promise<NodeTypes.GetAppInstanceDetailsResult | undefined> => {
    return await this._send(NodeTypes.RpcMethodName.GET_APP_INSTANCE_DETAILS, {
      appInstanceId,
    });
  };

  public getAppState = async (
    appInstanceId: string,
  ): Promise<NodeTypes.GetStateResult | undefined> => {
    return await this._send(NodeTypes.RpcMethodName.GET_STATE, { appInstanceId });
  };

  public takeAction = async (
    appInstanceId: string,
    action: AppActionBigNumber,
  ): Promise<NodeTypes.TakeActionResult> => {
    return await this._send(NodeTypes.RpcMethodName.TAKE_ACTION, {
      action,
      appInstanceId,
    });
  };

  public updateState = async (
    appInstanceId: string,
    newState: AppStateBigNumber | any,
    // cast to any bc no supported apps use
    // the update state method
  ): Promise<NodeTypes.UpdateStateResult> => {
    return await this._send(NodeTypes.RpcMethodName.UPDATE_STATE, {
      appInstanceId,
      newState,
    });
  };

  public proposeInstallVirtualApp = async (
    params: NodeTypes.ProposeInstallVirtualParams, // TODO THIS HAS TO CHANGE
  ): Promise<NodeTypes.ProposeInstallVirtualResult> => {
    return await this._send(NodeTypes.RpcMethodName.PROPOSE_INSTALL_VIRTUAL, { params });
  };

  public proposeInstallApp = async (
    params: NodeTypes.ProposeInstallParams, // TODO THIS HAS TO CHANGE
  ): Promise<NodeTypes.ProposeInstallResult> => {
    return await this._send(NodeTypes.RpcMethodName.PROPOSE_INSTALL, { params });
  };

  public installVirtualApp = async (
    appInstanceId: string,
    intermediaries: string[],
  ): Promise<NodeTypes.InstallVirtualResult> => {
    return await this._send(NodeTypes.RpcMethodName.INSTALL_VIRTUAL, {
      appInstanceId,
      intermediaries,
    });
  };

  public installApp = async (appInstanceId: string): Promise<NodeTypes.InstallResult> => {
    return await this._send(NodeTypes.RpcMethodName.INSTALL, { appInstanceId });
  };

  public uninstallApp = async (appInstanceId: string): Promise<NodeTypes.UninstallResult> => {
    return await this._send(NodeTypes.RpcMethodName.UNINSTALL, { appInstanceId });
  };

  public uninstallVirtualApp = async (
    appInstanceId: string,
    intermediary: string, // should be string array
  ): Promise<NodeTypes.UninstallVirtualResult> => {
    return await this._send(NodeTypes.RpcMethodName.UNINSTALL_VIRTUAL, {
      appInstanceId,
      intermediaryIdentifier: intermediary,
    });
  };

  public rejectInstallApp = async (appInstanceId: string): Promise<NodeTypes.UninstallResult> => {
    return await this._send(NodeTypes.RpcMethodName.REJECT_INSTALL, { appInstanceId });
  };

  public withdraw = async (
    amount: BigNumber,
    multisigAddress: string,
    assetId: string, // optional in cf
    recipient: string, // optional in cf
  ): Promise<NodeTypes.WithdrawResult> => {
    return await this._send(NodeTypes.RpcMethodName.WITHDRAW, {
      amount,
      assetId: makeChecksum(assetId),
      multisigAddress,
      recipient,
    });
  };

  ///////////////////////////////////////////////
  ///// PRIVATE METHODS

  // tslint:disable-next-line: function-name
  private async _send(
    methodName: NodeTypes.RpcMethodName,
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
        // NOTE: channel provider in wallet connect is expecting an
        // array type for parameters, it is easy to write a function
        // that casts object to an array, but seems obnoxious. should
        // circle up with pedro on that front for final call
        result = await this.connection._send(methodName, parameters);
        break;

      default:
        throw new Error(`Unknown rpc type: ${this.type}`);
    }
    return result;
  }
}
