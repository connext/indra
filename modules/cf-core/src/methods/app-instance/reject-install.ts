import { EventNames, MethodNames, MethodParams, MethodResults } from "@connext/types";
import { jsonRpcMethod } from "rpc-server";

import { RequestHandler } from "../../request-handler";
import {
  RejectProposalMessage,
} from "../../types";
import { NodeController } from "../controller";
import { NO_STATE_CHANNEL_FOR_APP_IDENTITY_HASH, NO_PROPOSED_APP_INSTANCE_FOR_APP_IDENTITY_HASH } from "../../errors";

export class RejectInstallController extends NodeController {
  protected async getRequiredLockNames(
    requestHandler: RequestHandler,
    params: MethodParams.RejectInstall,
  ): Promise<string[]> {
    const { appIdentityHash } = params;

    return [appIdentityHash];
  }

  @jsonRpcMethod(MethodNames.chan_rejectInstall)
  protected async executeMethodImplementation(
    requestHandler: RequestHandler,
    params: MethodParams.RejectInstall,
  ): Promise<MethodResults.RejectInstall> {
    const { store, messagingService, publicIdentifier } = requestHandler;

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

    const { proposedByIdentifier, proposedToIdentifier } = appInstanceProposal;
    const counterparty =
      publicIdentifier === proposedByIdentifier ? proposedToIdentifier : proposedByIdentifier;

    await messagingService.send(counterparty, rejectProposalMsg);

    return {};
  }
}
