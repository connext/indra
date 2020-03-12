import { REJECT_INSTALL_EVENT } from "@connext/types";
import { jsonRpcMethod } from "rpc-server";

import { RequestHandler } from "../../../request-handler";
import { CFCoreTypes, ProtocolTypes, RejectProposalMessage } from "../../../types";
import { NodeController } from "../../controller";

export default class RejectInstallController extends NodeController {
  protected async getRequiredLockNames(
    requestHandler: RequestHandler,
    params: CFCoreTypes.RejectInstallParams,
  ): Promise<string[]> {
    const { appInstanceId } = params;

    return [appInstanceId];
  }

  @jsonRpcMethod(ProtocolTypes.chan_rejectInstall)
  protected async executeMethodImplementation(
    requestHandler: RequestHandler,
    params: CFCoreTypes.RejectInstallParams,
  ): Promise<CFCoreTypes.RejectInstallResult> {
    const { store, messagingService, publicIdentifier } = requestHandler;

    const { appInstanceId } = params;

    const appInstanceProposal = await store.getAppInstanceProposal(appInstanceId);

    const stateChannel = await store.getStateChannelFromAppInstanceID(appInstanceId);

    await store.saveStateChannel(stateChannel.removeProposal(appInstanceId));

    const rejectProposalMsg: RejectProposalMessage = {
      from: publicIdentifier,
      type: REJECT_INSTALL_EVENT,
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
