import { EventNames, MethodNames, MethodParams, MethodResults } from "@connext/types";
import { jsonRpcMethod } from "rpc-server";

import { RequestHandler } from "../../request-handler";
import {
  RejectProposalMessage,
} from "../../types";
import { NodeController } from "../controller";
import { NO_STATE_CHANNEL_FOR_APP_INSTANCE_ID, NO_PROPOSED_APP_INSTANCE_FOR_APP_INSTANCE_ID } from "../../errors";

export class RejectInstallController extends NodeController {
  protected async getRequiredLockNames(
    requestHandler: RequestHandler,
    params: MethodParams.RejectInstall,
  ): Promise<string[]> {
    const { appInstanceId } = params;

    return [appInstanceId];
  }

  @jsonRpcMethod(MethodNames.chan_rejectInstall)
  protected async executeMethodImplementation(
    requestHandler: RequestHandler,
    params: MethodParams.RejectInstall,
  ): Promise<MethodResults.RejectInstall> {
    const { store, messagingService, publicIdentifier } = requestHandler;

    const { appInstanceId } = params;

    const appInstanceProposal = await store.getAppProposal(appInstanceId);
    if (!appInstanceProposal) {
      throw new Error(NO_PROPOSED_APP_INSTANCE_FOR_APP_INSTANCE_ID(appInstanceId));
    }

    const stateChannel = await store.getStateChannelByAppInstanceId(appInstanceId);
    if (!stateChannel) {
      throw new Error(NO_STATE_CHANNEL_FOR_APP_INSTANCE_ID(appInstanceId));
    }
    
    await store.removeAppProposal(stateChannel.multisigAddress, appInstanceId);

    const rejectProposalMsg: RejectProposalMessage = {
      from: publicIdentifier,
      type: EventNames.REJECT_INSTALL_EVENT,
      data: {
        appInstanceId,
      },
    };

    const { proposedByIdentifier, proposedToIdentifier } = appInstanceProposal;
    const counterparty =
      publicIdentifier === proposedByIdentifier ? proposedToIdentifier : proposedByIdentifier;

    await messagingService.send(counterparty, rejectProposalMsg);

    return {};
  }
}
