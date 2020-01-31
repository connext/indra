import { CoinBalanceRefundAppState } from "@connext/types";
import { jsonRpcMethod } from "rpc-server";

import { uninstallAppInstanceFromChannel } from "./operation";

import {
  APP_ALREADY_UNINSTALLED,
  CANNOT_UNINSTALL_FREE_BALANCE,
  NO_APP_INSTANCE_ID_TO_UNINSTALL,
  NOT_YOUR_BALANCE_REFUND_APP
} from "../../errors";

import { xkeyKthAddress } from "../../../machine";
import { RequestHandler } from "../../../request-handler";
import { CFCoreTypes, ProtocolTypes } from "../../../types";
import { getFirstElementInListNotEqualTo } from "../../../utils";
import { NodeController } from "../../controller";

export default class UninstallController extends NodeController {
  @jsonRpcMethod(ProtocolTypes.chan_uninstall)
  public executeMethod = super.executeMethod;

  protected async getRequiredLockNames(
    requestHandler: RequestHandler,
    params: CFCoreTypes.UninstallVirtualParams
  ): Promise<string[]> {
    const { store } = requestHandler;
    const { appInstanceId } = params;

    const sc = await store.getChannelFromAppInstanceID(appInstanceId);

    if (sc.freeBalance.identityHash === appInstanceId) {
      throw Error(CANNOT_UNINSTALL_FREE_BALANCE(sc.multisigAddress));
    }

    return [sc.multisigAddress, appInstanceId];
  }

  protected async beforeExecution(
    // @ts-ignore
    requestHandler: RequestHandler,
    params: CFCoreTypes.UninstallParams
  ) {
    const { store, publicIdentifier, networkContext } = requestHandler;
    const { appInstanceId } = params;

    if (!appInstanceId) {
      throw Error(NO_APP_INSTANCE_ID_TO_UNINSTALL);
    }

    // check if its the balance refund app
    const app = await store.getAppInstance(appInstanceId);
    if (app.appInterface.addr !== networkContext.CoinBalanceRefundApp) {
      return;
    }

    // make sure its your app
    const { recipient } = app.latestState as CoinBalanceRefundAppState;
    if (recipient !== xkeyKthAddress(publicIdentifier)) {
      throw new Error(NOT_YOUR_BALANCE_REFUND_APP);
    }
  }

  protected async executeMethodImplementation(
    requestHandler: RequestHandler,
    params: CFCoreTypes.UninstallParams
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

    const to = getFirstElementInListNotEqualTo(
      publicIdentifier,
      stateChannel.userNeuteredExtendedKeys
    );

    await uninstallAppInstanceFromChannel(
      store,
      protocolRunner,
      publicIdentifier,
      to,
      appInstanceId
    );

    return { appInstanceId };
  }
}
