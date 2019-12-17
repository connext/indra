import { INVALID_ARGUMENT } from "ethers/errors";
import { jsonRpcMethod } from "rpc-server";

import { Protocol, ProtocolRunner } from "../../../machine";
import { StateChannel } from "../../../models";
import { RequestHandler } from "../../../request-handler";
import { Store } from "../../../store";
import { CFCoreTypes, SolidityValueType } from "../../../types";
import { getFirstElementInListNotEqualTo } from "../../../utils";
import { NodeController } from "../../controller";
import {
  IMPROPERLY_FORMATTED_STRUCT,
  NO_APP_INSTANCE_FOR_TAKE_ACTION,
  STATE_OBJECT_NOT_ENCODABLE
} from "../../errors";

export default class UpdateStateController extends NodeController {
  @jsonRpcMethod(CFCoreTypes.RpcMethodNames.chan_updateState)
  public executeMethod = super.executeMethod;

  protected async getRequiredLockNames(
    // @ts-ignore
    requestHandler: RequestHandler,
    params: CFCoreTypes.UpdateStateParams
  ): Promise<string[]> {
    return [params.appInstanceId];
  }

  protected async beforeExecution(
    requestHandler: RequestHandler,
    params: CFCoreTypes.UpdateStateParams
  ): Promise<void> {
    const { store } = requestHandler;
    const { appInstanceId, newState } = params;

    if (!appInstanceId) {
      throw Error(NO_APP_INSTANCE_FOR_TAKE_ACTION);
    }

    const appInstance = await store.getAppInstance(appInstanceId);

    try {
      appInstance.encodeState(newState);
    } catch (e) {
      if (e.code === INVALID_ARGUMENT) {
        throw Error(`${IMPROPERLY_FORMATTED_STRUCT}: ${e.message}`);
      }
      throw Error(STATE_OBJECT_NOT_ENCODABLE);
    }
  }

  protected async executeMethodImplementation(
    requestHandler: RequestHandler,
    params: CFCoreTypes.UpdateStateParams
  ): Promise<CFCoreTypes.UpdateStateResult> {
    const { store, publicIdentifier, protocolRunner } = requestHandler;
    const { appInstanceId, newState } = params;

    const sc = await store.getChannelFromAppInstanceID(appInstanceId);

    const responderXpub = getFirstElementInListNotEqualTo(
      publicIdentifier,
      sc.userNeuteredExtendedKeys
    );

    await runUpdateStateProtocol(
      appInstanceId,
      store,
      protocolRunner,
      publicIdentifier,
      responderXpub,
      newState
    );

    return { newState };
  }
}

async function runUpdateStateProtocol(
  appIdentityHash: string,
  store: Store,
  protocolRunner: ProtocolRunner,
  initiatorXpub: string,
  responderXpub: string,
  newState: SolidityValueType
) {
  const stateChannel = await store.getChannelFromAppInstanceID(appIdentityHash);

  const stateChannelsMap = await protocolRunner.initiateProtocol(
    Protocol.Update,
    new Map<string, StateChannel>([
      [stateChannel.multisigAddress, stateChannel]
    ]),
    {
      initiatorXpub,
      responderXpub,
      appIdentityHash,
      newState,
      multisigAddress: stateChannel.multisigAddress
    }
  );
}
