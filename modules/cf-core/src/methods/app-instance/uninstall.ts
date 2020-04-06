import { MethodNames, MethodParams, MethodResults, ProtocolNames, IStoreService } from "@connext/types";
import { jsonRpcMethod } from "rpc-server";

import {
  APP_ALREADY_UNINSTALLED,
  CANNOT_UNINSTALL_FREE_BALANCE,
  NO_APP_INSTANCE_ID_TO_UNINSTALL,
  USE_RESCIND_DEPOSIT_RIGHTS,
  NO_STATE_CHANNEL_FOR_APP_INSTANCE_ID,
  NO_APP_INSTANCE_FOR_GIVEN_ID,
} from "../../errors";
import { ProtocolRunner } from "../../machine";
import { RequestHandler } from "../../request-handler";
import { getFirstElementInListNotEqualTo } from "../../utils";
import { NodeController } from "../controller";
import { StateChannel } from "../../models";

export class UninstallController extends NodeController {
  @jsonRpcMethod(MethodNames.chan_uninstall)
  public executeMethod = super.executeMethod;

  protected async getRequiredLockNames(
    requestHandler: RequestHandler,
    params: MethodParams.Uninstall,
  ): Promise<string[]> {
    const { store } = requestHandler;
    const { appInstanceId } = params;

    const sc = await store.getStateChannelByAppInstanceId(appInstanceId);
    if (!sc) {
      throw new Error(NO_STATE_CHANNEL_FOR_APP_INSTANCE_ID(appInstanceId));
    }

    return [sc.multisigAddress, appInstanceId];
  }

  protected async beforeExecution(
    requestHandler: RequestHandler,
    params: MethodParams.Uninstall,
  ) {
    const { store } = requestHandler;
    const { appInstanceId } = params;

    if (!appInstanceId) {
      throw new Error(NO_APP_INSTANCE_ID_TO_UNINSTALL);
    }

    const sc = await store.getStateChannelByAppInstanceId(appInstanceId);
    if (!sc) {
      throw new Error(NO_STATE_CHANNEL_FOR_APP_INSTANCE_ID(appInstanceId));
    }

    if (sc.freeBalanceAppInstance && sc.freeBalanceAppInstance!.identityHash === appInstanceId) {
      throw new Error(CANNOT_UNINSTALL_FREE_BALANCE(sc.multisigAddress));
    }

    // check if its the balance refund app
    const app = await store.getAppInstance(appInstanceId);
    if (!app) {
      throw new Error(NO_APP_INSTANCE_FOR_GIVEN_ID);
    }
  }

  protected async executeMethodImplementation(
    requestHandler: RequestHandler,
    params: MethodParams.Uninstall,
  ): Promise<MethodResults.Uninstall> {
    const { store, protocolRunner, publicIdentifier } = requestHandler;
    const { appInstanceId } = params;

    if (!appInstanceId) {
      throw new Error(NO_APP_INSTANCE_ID_TO_UNINSTALL);
    }

    const app = await store.getAppInstance(appInstanceId);
    if (!app) {
      throw new Error(APP_ALREADY_UNINSTALLED(appInstanceId));
    }

    const stateChannel = await store.getStateChannelByAppInstanceId(appInstanceId);

    if (!stateChannel) {
      throw new Error(NO_STATE_CHANNEL_FOR_APP_INSTANCE_ID(appInstanceId));
    }

    const to = getFirstElementInListNotEqualTo(
      publicIdentifier,
      stateChannel.userNeuteredExtendedKeys,
    );

    await uninstallAppInstanceFromChannel(
      store,
      protocolRunner,
      publicIdentifier,
      to,
      appInstanceId,
    );

    return { appInstanceId };
  }
}

export async function uninstallAppInstanceFromChannel(
  store: IStoreService,
  protocolRunner: ProtocolRunner,
  initiatorXpub: string,
  responderXpub: string,
  appInstanceId: string,
): Promise<void> {
  const json = await store.getStateChannelByAppInstanceId(appInstanceId);
  if (!json) {
    throw new Error(`Could not find state channel in store associated with app ${appInstanceId} when uninstalling`);
  }
  const stateChannel = StateChannel.fromJson(json);

  const appInstance = stateChannel.getAppInstance(appInstanceId);

  await protocolRunner.initiateProtocol(ProtocolNames.uninstall, {
    initiatorXpub,
    responderXpub,
    multisigAddress: stateChannel.multisigAddress,
    appIdentityHash: appInstance.identityHash,
  });
}
