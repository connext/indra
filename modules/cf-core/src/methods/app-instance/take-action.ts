import {
  EventNames,
  IStoreService,
  MethodNames,
  MethodParams,
  MethodResults,
  ProtocolNames,
  SolidityValueType,
  UpdateStateMessage,
  PublicIdentifier,
} from "@connext/types";
import { BigNumber, utils } from "ethers";
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

import { NodeController } from "../controller";
import { AppInstance } from "../../models";

const { Logger } = utils;

export class TakeActionController extends NodeController {
  @jsonRpcMethod(MethodNames.chan_takeAction)
  public executeMethod = super.executeMethod;

  protected async getRequiredLockName(
    requestHandler: RequestHandler,
    params: MethodParams.TakeAction,
  ): Promise<string> {
    const app = await requestHandler.store.getAppInstance(params.appIdentityHash);
    if (!app) {
      throw new Error(NO_APP_INSTANCE_FOR_GIVEN_HASH);
    }
    return app.multisigAddress;
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
      if (e.code === Logger.errors.INVALID_ARGUMENT) {
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
    const { appIdentityHash, action, stateTimeout } = params;

    const sc = await store.getStateChannelByAppIdentityHash(appIdentityHash);
    if (!sc) {
      throw new Error(NO_STATE_CHANNEL_FOR_APP_IDENTITY_HASH(appIdentityHash));
    }
    const app = await store.getAppInstance(appIdentityHash);
    if (!app) {
      throw new Error(NO_APP_INSTANCE_FOR_GIVEN_HASH);
    }

    const { channel } = await runTakeActionProtocol(
      appIdentityHash,
      store,
      protocolRunner,
      publicIdentifier,
      sc.userIdentifiers.find((id) => id !== publicIdentifier)!,
      action,
      stateTimeout || BigNumber.from(app.defaultTimeout),
    );

    const appInstance = channel.getAppInstance(appIdentityHash);
    if (!appInstance) {
      throw new Error(NO_APP_INSTANCE_FOR_GIVEN_HASH);
    }

    return { newState: appInstance.state };
  }

  protected async afterExecution(
    requestHandler: RequestHandler,
    params: MethodParams.TakeAction,
    returnValue: MethodResults.TakeAction,
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
  initiatorIdentifier: PublicIdentifier,
  responderIdentifier: PublicIdentifier,
  action: SolidityValueType,
  stateTimeout: BigNumber,
) {
  const stateChannel = await store.getStateChannelByAppIdentityHash(appIdentityHash);
  if (!stateChannel) {
    throw new Error(NO_STATE_CHANNEL_FOR_APP_IDENTITY_HASH(appIdentityHash));
  }

  try {
    return await protocolRunner.initiateProtocol(ProtocolNames.takeAction, {
      initiatorIdentifier,
      responderIdentifier,
      appIdentityHash,
      action,
      multisigAddress: stateChannel.multisigAddress,
      stateTimeout,
    });
  } catch (e) {
    if (e.toString().indexOf(`VM Exception`) !== -1) {
      // TODO: Fetch the revert reason
      throw new Error(`${INVALID_ACTION}: ${e.message}`);
    }
    throw new Error(`Couldn't run TakeAction protocol: ${e.message}`);
  }
}
