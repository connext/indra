import {
  EventNames,
  MethodNames,
  MethodParams,
  MethodResults,
  RejectProposalMessage,
} from "@connext/types";
import { jsonRpcMethod } from "rpc-server";

import { RequestHandler } from "../../request-handler";

import { NodeController } from "../controller";
import {
  NO_STATE_CHANNEL_FOR_APP_IDENTITY_HASH,
  NO_PROPOSED_APP_INSTANCE_FOR_APP_IDENTITY_HASH,
} from "../../errors";

export class RejectInstallController extends NodeController {
  @jsonRpcMethod(MethodNames.chan_rejectInstall)
  public executeMethod = super.executeMethod;

  protected async getRequiredLockNames(
    requestHandler: RequestHandler,
    params: MethodParams.RejectInstall,
  ): Promise<string[]> {
    const { appIdentityHash } = params;
    const { store } = requestHandler;

    const stateChannel = await store.getStateChannelByAppIdentityHash(appIdentityHash);
    if (!stateChannel) {
      throw new Error(NO_STATE_CHANNEL_FOR_APP_IDENTITY_HASH(appIdentityHash));
    }

    const result = [appIdentityHash, stateChannel.multisigAddress];
    requestHandler.log.newContext("CF-RejectMethod").info(`Acquiring locks: [${result}]`);
    return result;
  }

  protected async executeMethodImplementation(
    requestHandler: RequestHandler,
    params: MethodParams.RejectInstall,
  ): Promise<MethodResults.RejectInstall> {
    const { store, messagingService, publicIdentifier } = requestHandler;
    requestHandler.log.newContext("CF-RejectMethod").info(
      `Called w params: ${JSON.stringify(params)}`,
    );

    const { appIdentityHash } = params;

    const appInstanceProposal = await store.getAppProposal(appIdentityHash);
    if (!appInstanceProposal) {
      throw new Error(NO_PROPOSED_APP_INSTANCE_FOR_APP_IDENTITY_HASH(appIdentityHash));
    }

    const stateChannel = await store.getStateChannelByAppIdentityHash(appIdentityHash);
    if (!stateChannel) {
      throw new Error(NO_STATE_CHANNEL_FOR_APP_IDENTITY_HASH(appIdentityHash));
    }

    await store.removeAppProposal(stateChannel.multisigAddress, appIdentityHash);

    const rejectProposalMsg: RejectProposalMessage = {
      from: publicIdentifier,
      type: EventNames.REJECT_INSTALL_EVENT,
      data: {
        appIdentityHash,
      },
    };

    const { initiatorIdentifier, responderIdentifier } = appInstanceProposal;
    const counterparty =
      publicIdentifier === initiatorIdentifier ? responderIdentifier : initiatorIdentifier;

    await messagingService.send(counterparty, rejectProposalMsg);

    return {};
  }
}
