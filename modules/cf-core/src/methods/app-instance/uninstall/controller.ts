import { jsonRpcMethod } from "rpc-server";

import { uninstallAppInstanceFromChannel } from "./operation";

import {
  APP_ALREADY_UNINSTALLED,
  CANNOT_UNINSTALL_FREE_BALANCE,
  NO_APP_INSTANCE_ID_TO_UNINSTALL,
  USE_RESCIND_DEPOSIT_RIGHTS,
} from "../../errors";

import { RequestHandler } from "../../../request-handler";
import { CFCoreTypes, ProtocolTypes } from "../../../types";
import { getFirstElementInListNotEqualTo } from "../../../utils";
import { NodeController } from "../../controller";

export default class UninstallController extends NodeController {
  @jsonRpcMethod(ProtocolTypes.chan_uninstall)
  public executeMethod = super.executeMethod;

  protected async getRequiredLockNames(
    requestHandler: RequestHandler,
    params: CFCoreTypes.UninstallVirtualParams,
  ): Promise<string[]> {
    const { store } = requestHandler;
    const { appInstanceId } = params;

    const sc = await store.getChannelFromAppInstanceID(appInstanceId);

    return [sc.multisigAddress, appInstanceId];
  }

  protected async beforeExecution(requestHandler: RequestHandler, params: CFCoreTypes.UninstallParams) {
    const { store, networkContext } = requestHandler;
    const { appInstanceId } = params;

    if (!appInstanceId) {
      throw Error(NO_APP_INSTANCE_ID_TO_UNINSTALL);
    }

    const sc = await store.getChannelFromAppInstanceID(appInstanceId);

    if (sc.freeBalance.identityHash === appInstanceId) {
      throw Error(CANNOT_UNINSTALL_FREE_BALANCE(sc.multisigAddress));
    }

    // check if its the balance refund app
    const app = await store.getAppInstance(appInstanceId);
    if (app.appInterface.addr === networkContext.CoinBalanceRefundApp) {
      throw Error(USE_RESCIND_DEPOSIT_RIGHTS);
    }
  }

  protected async executeMethodImplementation(
    requestHandler: RequestHandler,
    params: CFCoreTypes.UninstallParams,
  ): Promise<CFCoreTypes.UninstallResult> {
    const { store, protocolRunner, publicIdentifier } = requestHandler;
    const { appInstanceId } = params;

    if (!appInstanceId) {
      throw Error(NO_APP_INSTANCE_ID_TO_UNINSTALL);
    }

    const stateChannel = await store.getChannelFromAppInstanceID(appInstanceId);

    if (!stateChannel.hasAppInstance(appInstanceId)) {
      throw Error(APP_ALREADY_UNINSTALLED(appInstanceId));
    }

    const to = getFirstElementInListNotEqualTo(publicIdentifier, stateChannel.userNeuteredExtendedKeys);

    await uninstallAppInstanceFromChannel(store, protocolRunner, publicIdentifier, to, appInstanceId);

    return { appInstanceId };
  }
}
