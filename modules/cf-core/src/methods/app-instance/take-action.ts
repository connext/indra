import { EventNames, MethodNames, MethodParams, MethodResults, ProtocolNames, IStoreService } from "@connext/types";
import { INVALID_ARGUMENT } from "ethers/errors";
import { jsonRpcMethod } from "rpc-server";

import {
  IMPROPERLY_FORMATTED_STRUCT,
  INVALID_ACTION,
  NO_APP_INSTANCE_FOR_TAKE_ACTION,
  STATE_OBJECT_NOT_ENCODABLE,
  NO_APP_INSTANCE_FOR_GIVEN_HASH,
  NO_STATE_CHANNEL_FOR_APP_IDENTITY_HASH,
} from "../../errors";
import { ProtocolRunner } from "../../machine";
import { RequestHandler } from "../../request-handler";
import { SolidityValueType, UpdateStateMessage } from "../../types";
import { getFirstElementInListNotEqualTo } from "../../utils";

import { NodeController } from "../controller";
import { AppInstance } from "../../models";

export class TakeActionController extends NodeController {
  @jsonRpcMethod(MethodNames.chan_takeAction)
  public executeMethod = super.executeMethod;

  protected async getRequiredLockNames(
    requestHandler: RequestHandler,
    params: MethodParams.TakeAction,
  ): Promise<string[]> {
    const app = await requestHandler.store.getAppInstance(
      params.appIdentityHash,
    );
    if (!app) {
      throw new Error(NO_APP_INSTANCE_FOR_GIVEN_HASH);
    }
    return [app.multisigAddress, params.appIdentityHash];
  }

  protected async beforeExecution(
    requestHandler: RequestHandler,
    params: MethodParams.TakeAction,
  ): Promise<void> {
    const { store } = requestHandler;
    const { appIdentityHash, action } = params;

    if (!appIdentityHash) {
      throw new Error(NO_APP_INSTANCE_FOR_TAKE_ACTION);
    }

    const json = await store.getAppInstance(appIdentityHash);
    if (!json) {
      throw new Error(NO_APP_INSTANCE_FOR_GIVEN_HASH);
    }
    const appInstance = AppInstance.fromJson(json);

    try {
      appInstance.encodeAction(action);
    } catch (e) {
      if (e.code === INVALID_ARGUMENT) {
        throw new Error(`${IMPROPERLY_FORMATTED_STRUCT}: ${e.message}`);
      }
      throw new Error(STATE_OBJECT_NOT_ENCODABLE);
    }
  }

  protected async executeMethodImplementation(
    requestHandler: RequestHandler,
    params: MethodParams.TakeAction,
  ): Promise<MethodResults.TakeAction> {
    const { store, publicIdentifier, protocolRunner } = requestHandler;
    const { appIdentityHash, action } = params;

    const sc = await store.getStateChannelByAppIdentityHash(appIdentityHash);
    if (!sc) {
      throw new Error(NO_STATE_CHANNEL_FOR_APP_IDENTITY_HASH(appIdentityHash));
    }

    const responderXpub = getFirstElementInListNotEqualTo(
      publicIdentifier,
      sc.userNeuteredExtendedKeys,
    );

    await runTakeActionProtocol(
      appIdentityHash,
      store,
      protocolRunner,
      publicIdentifier,
      responderXpub,
      action,
    );

    const appInstance = await store.getAppInstance(appIdentityHash);
    if (!appInstance) {
      throw new Error(NO_APP_INSTANCE_FOR_GIVEN_HASH);
    }

    return { newState: AppInstance.fromJson(appInstance).state };
  }

  protected async afterExecution(
    requestHandler: RequestHandler,
    params: MethodParams.TakeAction,
  ): Promise<void> {
    const { store, router, publicIdentifier } = requestHandler;
    const { appIdentityHash, action } = params;

    const appInstance = await store.getAppInstance(appIdentityHash);
    if (!appInstance) {
      throw new Error(NO_APP_INSTANCE_FOR_GIVEN_HASH);
    }

    const msg = {
      from: publicIdentifier,
      type: EventNames.UPDATE_STATE_EVENT,
      data: { appIdentityHash, action, newState: AppInstance.fromJson(appInstance).state },
    } as UpdateStateMessage;

    await router.emit(msg.type, msg, `outgoing`);
  }
}

async function runTakeActionProtocol(
  appIdentityHash: string,
  store: IStoreService,
  protocolRunner: ProtocolRunner,
  initiatorXpub: string,
  responderXpub: string,
  action: SolidityValueType,
) {
  const stateChannel = await store.getStateChannelByAppIdentityHash(appIdentityHash);
    if (!stateChannel) {
      throw new Error(NO_STATE_CHANNEL_FOR_APP_IDENTITY_HASH(appIdentityHash));
    }

  try {
    await protocolRunner.initiateProtocol(ProtocolNames.takeAction, {
      initiatorXpub,
      responderXpub,
      appIdentityHash,
      action,
      multisigAddress: stateChannel.multisigAddress,
    });
  } catch (e) {
    if (e.toString().indexOf(`VM Exception`) !== -1) {
      // TODO: Fetch the revert reason
      throw new Error(`${INVALID_ACTION}: ${e.message}`);
    }
    throw new Error(`Couldn't run TakeAction protocol: ${e.message}`);
  }

  return {};
}
