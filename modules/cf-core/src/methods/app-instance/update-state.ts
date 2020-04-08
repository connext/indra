import {
  IStoreService,
  MethodNames,
  MethodParams,
  MethodResults,
  ProtocolNames,
  SolidityValueType,
} from "@connext/types";
import { Zero } from "ethers/constants";
import { INVALID_ARGUMENT } from "ethers/errors";
import { BigNumber } from "ethers/utils";
import { jsonRpcMethod } from "rpc-server";

import {
  IMPROPERLY_FORMATTED_STRUCT,
  NO_APP_INSTANCE_FOR_TAKE_ACTION,
  STATE_OBJECT_NOT_ENCODABLE,
  NO_STATE_CHANNEL_FOR_APP_IDENTITY_HASH,
  NO_APP_INSTANCE_FOR_GIVEN_HASH,
} from "../../errors";
import { ProtocolRunner } from "../../machine";
import { RequestHandler } from "../../request-handler";
import { getFirstElementInListNotEqualTo } from "../../utils";
import { NodeController } from "../controller";
import { AppInstance } from "../../models";

export class UpdateStateController extends NodeController {
  @jsonRpcMethod(MethodNames.chan_updateState)
  public executeMethod = super.executeMethod;

  protected async getRequiredLockNames(
    requestHandler: RequestHandler,
    params: MethodParams.UpdateState,
  ): Promise<string[]> {
    return [params.appIdentityHash];
  }

  protected async beforeExecution(
    requestHandler: RequestHandler,
    params: MethodParams.UpdateState,
  ): Promise<void> {
    const { store } = requestHandler;
    const { appIdentityHash, newState } = params;

    if (!appIdentityHash) {
      throw new Error(NO_APP_INSTANCE_FOR_TAKE_ACTION);
    }

    const appJson = await store.getAppInstance(appIdentityHash);
    if (!appJson) {
      throw new Error(NO_APP_INSTANCE_FOR_GIVEN_HASH);
    }
    const appInstance = AppInstance.fromJson(appJson);

    try {
      appInstance.encodeState(newState);
    } catch (e) {
      if (e.code === INVALID_ARGUMENT) {
        throw new Error(`${IMPROPERLY_FORMATTED_STRUCT}: ${e.message}`);
      }
      throw new Error(STATE_OBJECT_NOT_ENCODABLE);
    }
  }

  protected async executeMethodImplementation(
    requestHandler: RequestHandler,
    params: MethodParams.UpdateState,
  ): Promise<MethodResults.UpdateState> {
    const { store, publicIdentifier, protocolRunner } = requestHandler;
    const { appIdentityHash, newState, stateTimeout } = params;

    const sc = await store.getStateChannelByAppIdentityHash(appIdentityHash);
    if (!sc) {
      throw new Error(NO_STATE_CHANNEL_FOR_APP_IDENTITY_HASH(appIdentityHash));
    }

    const responderXpub = getFirstElementInListNotEqualTo(
      publicIdentifier,
      sc.userNeuteredExtendedKeys,
    );

    await runUpdateStateProtocol(
      appIdentityHash,
      store,
      protocolRunner,
      publicIdentifier,
      responderXpub,
      newState,
      stateTimeout,
    );

    return { newState };
  }
}

async function runUpdateStateProtocol(
  appIdentityHash: string,
  store: IStoreService,
  protocolRunner: ProtocolRunner,
  initiatorXpub: string,
  responderXpub: string,
  newState: SolidityValueType,
  stateTimeout: BigNumber = Zero,
) {
  const stateChannel = await store.getStateChannelByAppIdentityHash(appIdentityHash);
  if (!stateChannel) {
    throw new Error(NO_STATE_CHANNEL_FOR_APP_IDENTITY_HASH(appIdentityHash));
  }

  await protocolRunner.initiateProtocol(ProtocolNames.update, {
    initiatorXpub,
    responderXpub,
    appIdentityHash,
    newState,
    multisigAddress: stateChannel.multisigAddress,
    stateTimeout,
  });
}
