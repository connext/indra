import { INVALID_ARGUMENT } from "ethers/errors";
import { jsonRpcMethod } from "rpc-server";

import { Protocol, ProtocolRunner } from "../../../machine";
import { StateChannel } from "../../../models";
import { RequestHandler } from "../../../request-handler";
import { Store } from "../../../store";
import { CFCoreTypes, NODE_EVENTS, SolidityValueType, UpdateStateMessage } from "../../../types";
import { getFirstElementInListNotEqualTo } from "../../../utils";
import { NodeController } from "../../controller";
import {
  IMPROPERLY_FORMATTED_STRUCT,
  INVALID_ACTION,
  NO_APP_INSTANCE_FOR_TAKE_ACTION,
  STATE_OBJECT_NOT_ENCODABLE
} from "../../errors";

export default class TakeActionController extends NodeController {
  @jsonRpcMethod(CFCoreTypes.RpcMethodNames.chan_takeAction)
  public executeMethod = super.executeMethod;

  protected async getRequiredLockNames(
    // @ts-ignore
    requestHandler: RequestHandler,
    params: CFCoreTypes.TakeActionParams
  ): Promise<string[]> {
    const multisigAddress = await requestHandler.store.getMultisigAddressFromAppInstance(
      params.appInstanceId
    );
    return [multisigAddress, params.appInstanceId];
  }

  protected async beforeExecution(
    requestHandler: RequestHandler,
    params: CFCoreTypes.TakeActionParams
  ): Promise<void> {
    const { store } = requestHandler;
    const { appInstanceId, action } = params;

    if (!appInstanceId) {
      throw Error(NO_APP_INSTANCE_FOR_TAKE_ACTION);
    }

    const appInstance = await store.getAppInstance(appInstanceId);

    try {
      appInstance.encodeAction(action);
    } catch (e) {
      if (e.code === INVALID_ARGUMENT) {
        throw Error(`${IMPROPERLY_FORMATTED_STRUCT}: ${e.message}`);
      }
      throw Error(STATE_OBJECT_NOT_ENCODABLE);
    }
  }

  protected async executeMethodImplementation(
    requestHandler: RequestHandler,
    params: CFCoreTypes.TakeActionParams
  ): Promise<CFCoreTypes.TakeActionResult> {
    const { store, publicIdentifier, protocolRunner } = requestHandler;
    const { appInstanceId, action } = params;

    const sc = await store.getChannelFromAppInstanceID(appInstanceId);

    const responderXpub = getFirstElementInListNotEqualTo(
      publicIdentifier,
      sc.userNeuteredExtendedKeys
    );

    await runTakeActionProtocol(
      appInstanceId,
      store,
      protocolRunner,
      publicIdentifier,
      responderXpub,
      action
    );

    const appInstance = await store.getAppInstance(appInstanceId);

    return { newState: appInstance.state };
  }

  protected async afterExecution(
    requestHandler: RequestHandler,
    params: CFCoreTypes.TakeActionParams
  ): Promise<void> {
    const { store, router, publicIdentifier } = requestHandler;
    const { appInstanceId, action } = params;

    const appInstance = await store.getAppInstance(appInstanceId);

    const msg = {
      from: publicIdentifier,
      type: "UPDATE_STATE_EVENT",
      data: { appInstanceId, action, newState: appInstance.state }
    } as UpdateStateMessage;

    await router.emit(msg.type, msg, "outgoing");
  }
}

async function runTakeActionProtocol(
  appIdentityHash: string,
  store: Store,
  protocolRunner: ProtocolRunner,
  initiatorXpub: string,
  responderXpub: string,
  action: SolidityValueType
) {
  const stateChannel = await store.getChannelFromAppInstanceID(appIdentityHash);

  let stateChannelsMap: Map<string, StateChannel>;

  try {
    stateChannelsMap = await protocolRunner.initiateProtocol(
      Protocol.TakeAction,
      new Map<string, StateChannel>([
        [stateChannel.multisigAddress, stateChannel]
      ]),
      {
        initiatorXpub,
        responderXpub,
        appIdentityHash,
        action,
        multisigAddress: stateChannel.multisigAddress
      }
    );
  } catch (e) {
    if (e.toString().indexOf("VM Exception") !== -1) {
      // TODO: Fetch the revert reason
      throw Error(`${INVALID_ACTION}: ${e.message}`);
    }
    throw Error(`Couldn't run TakeAction protocol: ${e.message}`);
  }

  return {};
}
