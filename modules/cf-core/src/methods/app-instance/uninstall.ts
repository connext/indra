import {
  IStoreService,
  MethodNames,
  MethodParams,
  MethodResults,
  ProtocolNames,
  PublicIdentifier,
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
      store,
      protocolRunner,
      publicIdentifier,
      stateChannel.userIdentifiers.find(id => id !== publicIdentifier)!,
      appIdentityHash,
    );

    return { appIdentityHash };
  }
}

export async function uninstallAppInstanceFromChannel(
  store: IStoreService,
  protocolRunner: ProtocolRunner,
  initiatorIdentifier: PublicIdentifier,
  responderIdentifier: PublicIdentifier,
  appIdentityHash: string,
): Promise<void> {
  const json = await store.getStateChannelByAppIdentityHash(appIdentityHash);
  if (!json) {
    throw new Error(`Could not find state channel in store associated with app ${appIdentityHash} when uninstalling`);
  }
  const stateChannel = StateChannel.fromJson(json);

  const appInstance = stateChannel.getAppInstance(appIdentityHash);

  await protocolRunner.initiateProtocol(ProtocolNames.uninstall, {
    initiatorIdentifier,
    responderIdentifier,
    multisigAddress: stateChannel.multisigAddress,
    appIdentityHash: appInstance.identityHash,
  });
}
