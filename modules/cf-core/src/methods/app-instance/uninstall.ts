import {
  IStoreService,
  MethodNames,
  MethodParams,
  MethodResults,
  ProtocolNames,
  PublicIdentifier,
  EventNames,
  UninstallMessage,
} from "@connext/types";
import { jsonRpcMethod } from "rpc-server";

import {
  APP_ALREADY_UNINSTALLED,
  CANNOT_UNINSTALL_FREE_BALANCE,
  NO_APP_IDENTITY_HASH_TO_UNINSTALL,
  NO_STATE_CHANNEL_FOR_APP_IDENTITY_HASH,
  NO_APP_INSTANCE_FOR_GIVEN_HASH,
} from "../../errors";
import { ProtocolRunner } from "../../machine";
import { RequestHandler } from "../../request-handler";
import { NodeController } from "../controller";
import { StateChannel } from "../../models";

export class UninstallController extends NodeController {
  @jsonRpcMethod(MethodNames.chan_uninstall)
  public executeMethod = super.executeMethod;

  protected async getRequiredLockName(
    requestHandler: RequestHandler,
    params: MethodParams.Uninstall,
  ): Promise<string> {
    return params.multisigAddress;
  }

  protected async beforeExecution(
    requestHandler: RequestHandler,
    params: MethodParams.Uninstall,
    preProtocolStateChannel: StateChannel | undefined,
  ) {
    const { store } = requestHandler;
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
      throw new Error(NO_APP_INSTANCE_FOR_GIVEN_HASH);
    }
  }

  protected async executeMethodImplementation(
    requestHandler: RequestHandler,
    params: MethodParams.Uninstall,
    preProtocolStateChannel: StateChannel | undefined,
  ): Promise<{ updatedChannel: StateChannel; result: MethodResults.Uninstall }> {
    const { store, protocolRunner, publicIdentifier } = requestHandler;
    const { appIdentityHash } = params;

    const updatedChannel = await uninstallAppInstanceFromChannel(
      preProtocolStateChannel!,
      protocolRunner,
      publicIdentifier,
      preProtocolStateChannel!.userIdentifiers.find((id) => id !== publicIdentifier)!,
      appIdentityHash,
    );

    return {
      updatedChannel,
      result: { appIdentityHash, multisigAddress: updatedChannel.multisigAddress },
    };
  }

  protected async afterExecution(
    requestHandler: RequestHandler,
    params: MethodParams.Uninstall,
    updatedChannel: StateChannel | undefined,
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
  protocolRunner: ProtocolRunner,
  initiatorIdentifier: PublicIdentifier,
  responderIdentifier: PublicIdentifier,
  appIdentityHash: string,
): Promise<StateChannel> {
  const appInstance = stateChannel.getAppInstance(appIdentityHash);

  const { channel: updatedChannel } = await protocolRunner.initiateProtocol(
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
