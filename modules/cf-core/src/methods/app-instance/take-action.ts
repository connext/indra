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
import { toBN } from "@connext/utils";
import { BigNumber, errors } from "ethers";

import {
  IMPROPERLY_FORMATTED_STRUCT,
  INVALID_ACTION,
  NO_APP_INSTANCE_FOR_TAKE_ACTION,
  STATE_OBJECT_NOT_ENCODABLE,
  NO_APP_INSTANCE_FOR_GIVEN_HASH,
  NO_STATE_CHANNEL_FOR_APP_IDENTITY_HASH,
  NO_MULTISIG_IN_PARAMS,
} from "../../errors";
import { ProtocolRunner } from "../../machine";
import { StateChannel } from "../../models/state-channel";
import { RequestHandler } from "../../request-handler";
import { RpcRouter } from "../../rpc-router";

import { MethodController } from "../controller";

export class TakeActionController extends MethodController {
  public readonly methodName = MethodNames.chan_takeAction;

  public executeMethod = super.executeMethod;

  protected async getRequiredLockName(
    requestHandler: RequestHandler,
    params: MethodParams.TakeAction,
  ): Promise<string> {
    if (!params.multisigAddress) {
      throw new Error(NO_MULTISIG_IN_PARAMS(params));
    }
    return params.multisigAddress;
  }

  protected async beforeExecution(
    requestHandler: RequestHandler,
    params: MethodParams.TakeAction,
    preProtocolStateChannel: StateChannel | undefined,
  ): Promise<MethodResults.TakeAction | undefined> {
    const { appIdentityHash, action } = params;

    if (!appIdentityHash) {
      throw new Error(NO_APP_INSTANCE_FOR_TAKE_ACTION);
    }

    if (!preProtocolStateChannel) {
      throw new Error(NO_STATE_CHANNEL_FOR_APP_IDENTITY_HASH(appIdentityHash));
    }

    const appInstance = preProtocolStateChannel.appInstances.get(appIdentityHash);
    if (!appInstance) {
      throw new Error(NO_APP_INSTANCE_FOR_GIVEN_HASH(appIdentityHash));
    }

    try {
      appInstance.encodeAction(action);
    } catch (e) {
      if (e.code === errors.INVALID_ARGUMENT) {
        throw new Error(`${IMPROPERLY_FORMATTED_STRUCT}: ${e.message}`);
      }
      throw new Error(STATE_OBJECT_NOT_ENCODABLE);
    }
    // NOTE: there's nothing that prevents the same action from being applied
    // multiple times, so always execute the method.
    return undefined;
  }

  protected async executeMethodImplementation(
    requestHandler: RequestHandler,
    params: MethodParams.TakeAction,
    preProtocolStateChannel: StateChannel,
  ): Promise<MethodResults.TakeAction> {
    const { publicIdentifier, protocolRunner, router } = requestHandler;
    const { appIdentityHash, action, stateTimeout } = params;

    const app = preProtocolStateChannel!.appInstances.get(appIdentityHash)!;

    const { channel } = await runTakeActionProtocol(
      appIdentityHash,
      preProtocolStateChannel,
      router,
      protocolRunner,
      publicIdentifier,
      preProtocolStateChannel!.userIdentifiers.find((id) => id !== publicIdentifier)!,
      action,
      stateTimeout || toBN(app.defaultTimeout),
    );

    const appInstance = channel.getAppInstance(appIdentityHash);
    if (!appInstance) {
      throw new Error(NO_APP_INSTANCE_FOR_GIVEN_HASH(appIdentityHash));
    }

    return { newState: appInstance.state };
  }

  protected async afterExecution(
    requestHandler: RequestHandler,
    params: MethodParams.TakeAction,
    returnValue: MethodResults.TakeAction,
  ): Promise<void> {
    const { router, publicIdentifier } = requestHandler;
    const { appIdentityHash, action } = params;

    const msg = {
      from: publicIdentifier,
      type: EventNames.UPDATE_STATE_EVENT,
      data: { appIdentityHash, action, newState: returnValue.newState },
    } as UpdateStateMessage;

    await router.emit(msg.type, msg, `outgoing`);
  }
}

async function runTakeActionProtocol(
  appIdentityHash: string,
  preProtocolStateChannel: StateChannel,
  router: RpcRouter,
  protocolRunner: ProtocolRunner,
  initiatorIdentifier: PublicIdentifier,
  responderIdentifier: PublicIdentifier,
  action: SolidityValueType,
  stateTimeout: BigNumber,
) {
  try {
    return await protocolRunner.initiateProtocol(
      router,
      ProtocolNames.takeAction,
      {
        initiatorIdentifier,
        responderIdentifier,
        appIdentityHash,
        action,
        multisigAddress: preProtocolStateChannel.multisigAddress,
        stateTimeout,
      },
      preProtocolStateChannel,
    );
  } catch (e) {
    if (e.message.includes(`VM Exception`)) {
      // TODO: Fetch the revert reason
      throw new Error(`${INVALID_ACTION}: ${e.message}`);
    }
    throw new Error(`Couldn't run TakeAction protocol: ${e.stack}`);
  }
}
