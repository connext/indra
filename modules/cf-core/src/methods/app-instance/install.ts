import {
  MethodNames,
  MethodParams,
  MethodResults,
  ProtocolNames,
  ProtocolParams,
  PublicIdentifier,
  EventNames,
  InstallMessage,
} from "@connext/types";

import {
  NO_APP_IDENTITY_HASH_TO_INSTALL,
  NO_STATE_CHANNEL_FOR_APP_IDENTITY_HASH,
  NO_PROPOSED_APP_INSTANCE_FOR_APP_IDENTITY_HASH,
  NO_MULTISIG_IN_PARAMS,
  TOO_MANY_APPS_IN_CHANNEL,
} from "../../errors";
import { ProtocolRunner } from "../../machine";
import { StateChannel } from "../../models";
import { RequestHandler } from "../../request-handler";
import { RpcRouter } from "../../rpc-router";

import { MethodController } from "../controller";
import { MAX_CHANNEL_APPS } from "../../constants";

/**
 * This converts a proposed app instance to an installed app instance while
 * sending an approved ack to the proposer.
 * @param params
 */
export class InstallAppInstanceController extends MethodController {
  public readonly methodName = MethodNames.chan_install;

  public executeMethod = super.executeMethod;

  protected async getRequiredLockNames(
    requestHandler: RequestHandler,
    params: MethodParams.Install,
  ): Promise<string[]> {
    if (!params.multisigAddress) {
      throw new Error(NO_MULTISIG_IN_PARAMS(params));
    }
    return [params.multisigAddress];
  }

  // should return true IFF the channel is in the correct state before
  // method execution
  protected async beforeExecution(
    requestHandler: RequestHandler,
    params: MethodParams.Install,
    preProtocolStateChannel: StateChannel | undefined,
  ): Promise<MethodResults.Install | undefined> {
    if (!preProtocolStateChannel) {
      throw new Error(NO_STATE_CHANNEL_FOR_APP_IDENTITY_HASH(params.appIdentityHash));
    }

    const { appIdentityHash } = params;

    if (!appIdentityHash || !appIdentityHash.trim()) {
      throw new Error(NO_APP_IDENTITY_HASH_TO_INSTALL);
    }

    if (preProtocolStateChannel.appInstances.size >= MAX_CHANNEL_APPS) {
      throw new Error(TOO_MANY_APPS_IN_CHANNEL);
    }

    const installed = preProtocolStateChannel.appInstances.get(appIdentityHash);
    if (installed) {
      return { appInstance: installed.toJson() };
    }

    const proposal = preProtocolStateChannel.proposedAppInstances.get(appIdentityHash);
    if (!proposal) {
      throw new Error(NO_PROPOSED_APP_INSTANCE_FOR_APP_IDENTITY_HASH(appIdentityHash));
    }
    return undefined;
  }

  protected async executeMethodImplementation(
    requestHandler: RequestHandler,
    params: MethodParams.Install,
    preProtocolStateChannel: StateChannel | undefined,
  ): Promise<MethodResults.Install> {
    const { protocolRunner, publicIdentifier, router } = requestHandler;
    if (!preProtocolStateChannel) {
      throw new Error("Could not find state channel in store to begin install protocol with");
    }

    const postProtocolChannel = await install(
      preProtocolStateChannel,
      router,
      protocolRunner,
      params,
      publicIdentifier,
    );

    const appInstance = postProtocolChannel.appInstances.get(params.appIdentityHash);
    if (!appInstance) {
      throw new Error(
        `Cannot find app instance after install protocol run for hash ${params.appIdentityHash}`,
      );
    }

    return {
      appInstance: appInstance.toJson(),
    };
  }

  protected async afterExecution(
    requestHandler: RequestHandler,
    params: MethodParams.Install,
    returnValue: MethodResults.Install,
  ): Promise<void> {
    const { router, publicIdentifier } = requestHandler;

    const msg = {
      from: publicIdentifier,
      type: EventNames.INSTALL_EVENT,
      data: { appIdentityHash: params.appIdentityHash, appInstance: returnValue.appInstance },
    } as InstallMessage;

    await router.emit(msg.type, msg, `outgoing`);
  }
}

export async function install(
  preProtocolStateChannel: StateChannel,
  router: RpcRouter,
  protocolRunner: ProtocolRunner,
  params: MethodParams.Install,
  initiatorIdentifier: PublicIdentifier,
): Promise<StateChannel> {
  const proposal = preProtocolStateChannel.proposedAppInstances.get(params.appIdentityHash);
  if (!proposal) {
    throw new Error(NO_PROPOSED_APP_INSTANCE_FOR_APP_IDENTITY_HASH(params.appIdentityHash));
  }
  const isSame = initiatorIdentifier === proposal.initiatorIdentifier;

  const { channel: postProtocolChannel } = await protocolRunner.initiateProtocol(
    router,
    ProtocolNames.install,
    {
      proposal,
      initiatorIdentifier,
      responderIdentifier: isSame ? proposal.responderIdentifier : proposal.initiatorIdentifier,
      multisigAddress: preProtocolStateChannel.multisigAddress,
    } as ProtocolParams.Install,
    preProtocolStateChannel,
  );

  return postProtocolChannel;
}
