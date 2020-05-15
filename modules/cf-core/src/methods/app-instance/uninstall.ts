import {
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

  protected async getRequiredLockNames(
    requestHandler: RequestHandler,
    params: MethodParams.Uninstall,
  ): Promise<string[]> {
    const { store } = requestHandler;
    const { appIdentityHash } = params;

    const sc = await store.getStateChannelByAppIdentityHash(appIdentityHash);
    if (!sc) {
      throw new Error(NO_STATE_CHANNEL_FOR_APP_IDENTITY_HASH(appIdentityHash));
    }

    const result = [sc.multisigAddress, appIdentityHash];
    requestHandler.log.newContext("UninstallMethod").info(`Acquiring locks: [${result}]`);
    return [sc.multisigAddress, appIdentityHash];
  }

  protected async beforeExecution(
    requestHandler: RequestHandler,
    params: MethodParams.Uninstall,
  ) {
    const { store } = requestHandler;
    const { appIdentityHash } = params;

    if (!appIdentityHash) {
      throw new Error(NO_APP_IDENTITY_HASH_TO_UNINSTALL);
    }

    const sc = await store.getStateChannelByAppIdentityHash(appIdentityHash);
    if (!sc) {
      throw new Error(NO_STATE_CHANNEL_FOR_APP_IDENTITY_HASH(appIdentityHash));
    }

    if (sc.freeBalanceAppInstance && sc.freeBalanceAppInstance!.identityHash === appIdentityHash) {
      throw new Error(CANNOT_UNINSTALL_FREE_BALANCE(sc.multisigAddress));
    }

    // check if its the balance refund app
    const app = await store.getAppInstance(appIdentityHash);
    if (!app) {
      throw new Error(NO_APP_INSTANCE_FOR_GIVEN_HASH);
    }
  }

  protected async executeMethodImplementation(
    requestHandler: RequestHandler,
    params: MethodParams.Uninstall,
  ): Promise<MethodResults.Uninstall> {
    const { store, protocolRunner, publicIdentifier } = requestHandler;
    const { appIdentityHash } = params;

    if (!appIdentityHash) {
      throw new Error(NO_APP_IDENTITY_HASH_TO_UNINSTALL);
    }

    const app = await store.getAppInstance(appIdentityHash);
    if (!app) {
      throw new Error(APP_ALREADY_UNINSTALLED(appIdentityHash));
    }

    const stateChannel = await store.getStateChannelByAppIdentityHash(appIdentityHash);

    if (!stateChannel) {
      throw new Error(NO_STATE_CHANNEL_FOR_APP_IDENTITY_HASH(appIdentityHash));
    }

    await uninstallAppInstanceFromChannel(
      StateChannel.fromJson(stateChannel),
      protocolRunner,
      publicIdentifier,
      stateChannel.userIdentifiers.find(id => id !== publicIdentifier)!,
      appIdentityHash,
    );

    return { appIdentityHash, multisigAddress: stateChannel.multisigAddress };
  }

  protected async afterExecution(
    requestHandler: RequestHandler,
    params: MethodParams.Uninstall,
    returnValue: MethodResults.Uninstall,
  ): Promise<void> {
    const { router, publicIdentifier } = requestHandler;
    const { appIdentityHash } = params;
    const {  multisigAddress } = returnValue;

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
): Promise<void> {
  const appInstance = stateChannel.getAppInstance(appIdentityHash);

  await protocolRunner.initiateProtocol(ProtocolNames.uninstall, {
    initiatorIdentifier,
    responderIdentifier,
    multisigAddress: stateChannel.multisigAddress,
    appIdentityHash: appInstance.identityHash,
  });
}
