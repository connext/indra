import {
  MethodNames,
  MethodParams,
  MethodResults,
  ProtocolNames,
  PublicIdentifier,
  EventNames,
  UninstallMessage,
} from "@connext/types";

import {
  CANNOT_UNINSTALL_FREE_BALANCE,
  NO_APP_IDENTITY_HASH_TO_UNINSTALL,
  NO_STATE_CHANNEL_FOR_APP_IDENTITY_HASH,
  NO_APP_INSTANCE_FOR_GIVEN_HASH,
  NO_MULTISIG_IN_PARAMS,
} from "../../errors";
import { ProtocolRunner } from "../../machine";
import { StateChannel } from "../../models";
import { RequestHandler } from "../../request-handler";
import { RpcRouter } from "../../rpc-router";

import { MethodController } from "../controller";

export class UninstallController extends MethodController {
  public readonly methodName = MethodNames.chan_uninstall;

  public executeMethod = super.executeMethod;

  protected async getRequiredLockName(
    requestHandler: RequestHandler,
    params: MethodParams.Uninstall,
  ): Promise<string> {
    if (!params.multisigAddress) {
      throw new Error(NO_MULTISIG_IN_PARAMS(params));
    }
    return params.multisigAddress;
  }

  protected async beforeExecution(
    requestHandler: RequestHandler,
    params: MethodParams.Uninstall,
    preProtocolStateChannel: StateChannel | undefined,
  ) {
    const { appIdentityHash } = params;

    if (!appIdentityHash) {
      throw new Error(NO_APP_IDENTITY_HASH_TO_UNINSTALL);
    }

    if (!preProtocolStateChannel) {
      throw new Error(NO_STATE_CHANNEL_FOR_APP_IDENTITY_HASH(appIdentityHash));
    }

    if (
      preProtocolStateChannel.freeBalance &&
      preProtocolStateChannel.freeBalance.identityHash === appIdentityHash
    ) {
      throw new Error(CANNOT_UNINSTALL_FREE_BALANCE(preProtocolStateChannel.multisigAddress));
    }

    // check if its the balance refund app
    const app = preProtocolStateChannel.appInstances.get(appIdentityHash);
    if (!app) {
      throw new Error(NO_APP_INSTANCE_FOR_GIVEN_HASH(appIdentityHash));
    }
  }

  protected async executeMethodImplementation(
    requestHandler: RequestHandler,
    params: MethodParams.Uninstall,
    preProtocolStateChannel: StateChannel | undefined,
  ): Promise<MethodResults.Uninstall> {
    const { protocolRunner, publicIdentifier, router } = requestHandler;
    const { appIdentityHash } = params;

    const updatedChannel = await uninstallAppInstanceFromChannel(
      preProtocolStateChannel!,
      router,
      protocolRunner,
      publicIdentifier,
      preProtocolStateChannel!.userIdentifiers.find((id) => id !== publicIdentifier)!,
      appIdentityHash,
    );

    return { appIdentityHash, multisigAddress: updatedChannel.multisigAddress };
  }

  protected async afterExecution(
    requestHandler: RequestHandler,
    params: MethodParams.Uninstall,
    returnValue: MethodResults.Uninstall,
  ): Promise<void> {
    const { router, publicIdentifier } = requestHandler;
    const { appIdentityHash } = params;
    const { multisigAddress } = returnValue;

    const msg = {
      from: publicIdentifier,
      type: EventNames.UNINSTALL_EVENT,
      data: { appIdentityHash, multisigAddress },
    } as UninstallMessage;

    await router.emit(msg.type, msg, `outgoing`);
  }
}

export async function uninstallAppInstanceFromChannel(
  stateChannel: StateChannel,
  router: RpcRouter,
  protocolRunner: ProtocolRunner,
  initiatorIdentifier: PublicIdentifier,
  responderIdentifier: PublicIdentifier,
  appIdentityHash: string,
): Promise<StateChannel> {
  const appInstance = stateChannel.getAppInstance(appIdentityHash);

  const { channel: updatedChannel } = await protocolRunner.initiateProtocol(
    router,
    ProtocolNames.uninstall,
    {
      initiatorIdentifier,
      responderIdentifier,
      multisigAddress: stateChannel.multisigAddress,
      appIdentityHash: appInstance.identityHash,
    },
  );
  return updatedChannel;
}
