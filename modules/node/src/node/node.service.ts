import { AppActionBigNumber } from "@connext/types";
import { Node } from "@counterfactual/node";
import { AppInstanceJson, AppInstanceProposal, Node as NodeTypes } from "@counterfactual/types";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { AddressZero, Zero } from "ethers/constants";
import { BigNumber } from "ethers/utils";

import { NodeProviderId } from "../constants";
import { CLogger, freeBalanceAddressFromXpub } from "../util";

const logger = new CLogger("NodeService");

Injectable();
export class NodeService {
  cfNode: Node;

  constructor(@Inject(NodeProviderId) private readonly node: Node) {
    this.cfNode = node;
  }

  async getFreeBalance(
    userPubId: string,
    multisigAddress: string,
    assetId: string = AddressZero,
  ): Promise<NodeTypes.GetFreeBalanceStateResult> {
    try {
      const freeBalance = await this.node.rpcRouter.dispatch({
        id: Date.now(),
        methodName: NodeTypes.RpcMethodName.GET_FREE_BALANCE_STATE,
        parameters: {
          multisigAddress,
          tokenAddress: assetId,
        },
      });
      return freeBalance.result.result as NodeTypes.GetFreeBalanceStateResult;
    } catch (e) {
      const error = `No free balance exists for the specified token: ${assetId}`;
      if (e.message.includes(error)) {
        // if there is no balance, return undefined
        // NOTE: can return free balance obj with 0s,
        // but need the nodes free balance
        // address in the multisig
        const obj = {};
        obj[freeBalanceAddressFromXpub(this.node.publicIdentifier)] = Zero;
        obj[freeBalanceAddressFromXpub(userPubId)] = Zero;
        return obj;
      }

      throw e;
    }
  }

  // TODO: fix typings, is StateChannel exported?
  async getStateChannel(multisigAddress: string): Promise<{ data: any }> {
    const params = {
      id: Date.now(),
      methodName: "chan_getStateChannel", // FIXME: NodeTypes.RpcMethodName.GET_STATE_CHANNEL,
      parameters: {
        multisigAddress,
      },
    }
    const getStateChannelRes = await this.cfNode.rpcRouter.dispatch(params);
    return getStateChannelRes.result.result;
  }

  async createChannel(
    counterpartyPublicIdentifier: string,
  ): Promise<NodeTypes.CreateChannelResult> {
    const params = {
      id: Date.now(),
      methodName: NodeTypes.RpcMethodName.CREATE_CHANNEL,
      parameters: {
        owners: [this.cfNode.publicIdentifier, counterpartyPublicIdentifier],
      } as NodeTypes.CreateChannelParams,
    };
    logger.log(`Calling createChannel with params: ${JSON.stringify(params, null, 2)}`);
    const createRes = await this.cfNode.rpcRouter.dispatch(params);
    logger.log(`createChannel called with result: ${JSON.stringify(createRes.result.result)}`);
    return createRes.result.result as NodeTypes.CreateChannelResult;
  }

  async deposit(
    multisigAddress: string,
    amount: BigNumber,
    assetId: string = AddressZero,
  ): Promise<NodeTypes.DepositResult> {
    const depositRes = await this.cfNode.rpcRouter.dispatch({
      id: Date.now(),
      methodName: NodeTypes.RpcMethodName.DEPOSIT,
      parameters: {
        amount,
        multisigAddress,
        tokenAddress: assetId,
      } as NodeTypes.DepositParams,
    });
    logger.log(`deposit called with result ${JSON.stringify(depositRes.result.result)}`);
    return depositRes.result.result as NodeTypes.DepositResult;
  }

  async proposeInstallApp(
    params: NodeTypes.ProposeInstallParams,
  ): Promise<NodeTypes.ProposeInstallResult> {
    const proposeRes = await this.cfNode.rpcRouter.dispatch({
      id: Date.now(),
      methodName: NodeTypes.RpcMethodName.PROPOSE_INSTALL,
      parameters: params,
    });
    logger.log(`proposeInstallApp called with result ${JSON.stringify(proposeRes.result.result)}`);
    return proposeRes.result.result as NodeTypes.ProposeInstallResult;
  }

  async installApp(appInstanceId: string): Promise<NodeTypes.InstallResult> {
    const installRes = await this.cfNode.rpcRouter.dispatch({
      id: Date.now(),
      methodName: NodeTypes.RpcMethodName.INSTALL,
      parameters: {
        appInstanceId,
      } as NodeTypes.InstallParams,
    });
    logger.log(`installApp called with result ${JSON.stringify(installRes.result.result)}`);
    return installRes.result.result as NodeTypes.InstallResult;
  }

  async rejectInstallApp(appInstanceId: string): Promise<NodeTypes.RejectInstallResult> {
    const rejectRes = await this.cfNode.rpcRouter.dispatch({
      id: Date.now(),
      methodName: NodeTypes.RpcMethodName.REJECT_INSTALL,
      parameters: {
        appInstanceId,
      } as NodeTypes.RejectInstallParams,
    });
    logger.log(`rejectInstallApp called with result ${JSON.stringify(rejectRes.result.result)}`);
    return rejectRes.result.result as NodeTypes.RejectInstallResult;
  }

  async takeAction(
    appInstanceId: string,
    action: AppActionBigNumber,
  ): Promise<NodeTypes.TakeActionResult> {
    // check the app is actually installed
    await this.assertAppInstalled(appInstanceId);
    // check state is not finalized
    const state: NodeTypes.GetStateResult = await this.getAppState(appInstanceId);
    // FIXME: casting?
    if ((state.state as any).finalized) {
      throw new Error("Cannot take action on an app with a finalized state.");
    }
    const actionResponse = await this.cfNode.rpcRouter.dispatch({
      id: Date.now(),
      methodName: NodeTypes.RpcMethodName.TAKE_ACTION,
      parameters: {
        action,
        appInstanceId,
      } as NodeTypes.TakeActionParams,
    });

    logger.log(`takeAction called with result ${JSON.stringify(actionResponse.result.result)}`);
    return actionResponse.result.result as NodeTypes.TakeActionResult;
  }

  async uninstallApp(appInstanceId: string): Promise<NodeTypes.UninstallResult> {
    // check the app is actually installed
    const err = await this.appNotInstalled(appInstanceId);
    if (err) {
      logger.error(err);
      throw new Error(err);
    }
    logger.log(`Calling uninstallApp for appInstanceId ${appInstanceId}`);
    const uninstallResponse = await this.cfNode.rpcRouter.dispatch({
      id: Date.now(),
      methodName: NodeTypes.RpcMethodName.UNINSTALL,
      parameters: {
        appInstanceId,
      },
    });

    logger.log(
      `uninstallApp called with result ${JSON.stringify(uninstallResponse.result.result)}`,
    );
    return uninstallResponse.result.result as NodeTypes.UninstallResult;
  }

  async getAppInstances(): Promise<AppInstanceJson[]> {
    const appInstanceResponse = await this.cfNode.rpcRouter.dispatch({
      id: Date.now(),
      methodName: NodeTypes.RpcMethodName.GET_APP_INSTANCES,
      parameters: {} as NodeTypes.GetAppInstancesParams,
    });

    /*
    logger.debug(
      `getAppInstances called with result ${JSON.stringify(appInstanceResponse.result.result)}`,
    );
    */
    return appInstanceResponse.result.result.appInstances as AppInstanceJson[];
  }

  async getProposedAppInstances(): Promise<AppInstanceProposal[]> {
    const appInstanceResponse = await this.cfNode.rpcRouter.dispatch({
      id: Date.now(),
      methodName: NodeTypes.RpcMethodName.GET_PROPOSED_APP_INSTANCES,
      parameters: {} as NodeTypes.GetAppInstancesParams,
    });

    logger.log(
      `getProposedAppInstances called with result ${JSON.stringify(
        appInstanceResponse.result.result,
      )}`,
    );
    return appInstanceResponse.result.result.appInstances as AppInstanceProposal[];
  }

  async getAppInstanceDetails(appInstanceId: string): Promise<AppInstanceJson> {
    let appInstance;
    try {
      const appInstanceResponse = await this.cfNode.rpcRouter.dispatch({
        id: Date.now(),
        methodName: NodeTypes.RpcMethodName.GET_APP_INSTANCE_DETAILS,
        parameters: { appInstanceId } as NodeTypes.GetAppInstanceDetailsParams,
      });
      appInstance = appInstanceResponse.result.result.appInstance;
    } catch (e) {
      if (e.message.includes("No multisig address exists for the given appInstanceId")) {
        logger.warn(`${e.message}: ${appInstanceId}`);
        appInstance = undefined;
      } else {
        throw e;
      }
    }
    logger.log(`getAppInstanceDetails called with result: ${JSON.stringify(appInstance)}`);
    return appInstance as AppInstanceJson;
  }

  async getAppState(appInstanceId: string): Promise<NodeTypes.GetStateResult | undefined> {
    // check the app is actually installed, or returned undefined
    const err = await this.appNotInstalled(appInstanceId);
    if (err) {
      Logger.warn(err);
      return undefined;
    }
    const stateResponse = await this.cfNode.rpcRouter.dispatch({
      id: Date.now(),
      methodName: NodeTypes.RpcMethodName.GET_STATE,
      parameters: {
        appInstanceId,
      } as NodeTypes.GetStateParams,
    });

    return stateResponse.result.result as NodeTypes.GetStateResult;
  }

  private async appNotInstalled(appInstanceId: string): Promise<string | undefined> {
    const apps = await this.getAppInstances();
    const app = apps.filter((app: AppInstanceJson) => app.identityHash === appInstanceId);
    if (!app || app.length === 0) {
      return (
        `Could not find installed app with id: ${appInstanceId}. ` +
        `Installed apps: ${JSON.stringify(apps, null, 2)}.`
      );
    }
    if (app.length > 1) {
      return (
        `CRITICAL ERROR: found multiple apps with the same id. ` +
        `Installed apps: ${JSON.stringify(apps, null, 2)}.`
      );
    }
    return undefined;
  }

  private async assertAppInstalled(appInstanceId: string): Promise<void> {
    const err = await this.appNotInstalled(appInstanceId);
    if (err) {
      throw new Error(err);
    }
  }

  registerCfNodeListener(
    event: NodeTypes.EventName,
    callback: (data: any) => any,
    context: string = "NodeService",
  ): void {
    Logger.log(`Registering node callback for event ${event}`, context);
    this.cfNode.on(event, callback);
  }
}
