import {
  EventNames,
  MethodNames,
  MethodParams,
  MethodResults,
  RejectProposalMessage,
} from "@connext/types";

import {
  NO_STATE_CHANNEL_FOR_APP_IDENTITY_HASH,
  NO_PROPOSED_APP_INSTANCE_FOR_APP_IDENTITY_HASH,
  NO_MULTISIG_IN_PARAMS,
} from "../../errors";
import { StateChannel } from "../../models/state-channel";
import { RequestHandler } from "../../request-handler";

import { MethodController } from "../controller";

export class RejectInstallController extends MethodController {
  public readonly methodName = MethodNames.chan_rejectInstall;

  public executeMethod = super.executeMethod;
  protected async getRequiredLockName(
    requestHandler: RequestHandler,
    params: MethodParams.RejectInstall,
  ): Promise<string> {
    if (!params.multisigAddress) {
      throw new Error(NO_MULTISIG_IN_PARAMS(params));
    }
    return params.multisigAddress;
  }

  protected async beforeExecution(
    requestHandler: RequestHandler,
    params: MethodParams.RejectInstall,
    preProtocolStateChannel: StateChannel | undefined,
  ): Promise<void> {
    const { appIdentityHash } = params;
    if (!preProtocolStateChannel) {
      throw new Error(NO_STATE_CHANNEL_FOR_APP_IDENTITY_HASH(appIdentityHash));
    }
    const proposal = preProtocolStateChannel.proposedAppInstances.get(appIdentityHash);
    if (!proposal) {
      throw new Error(NO_PROPOSED_APP_INSTANCE_FOR_APP_IDENTITY_HASH(appIdentityHash));
    }
  }

  protected async executeMethodImplementation(
    requestHandler: RequestHandler,
    params: MethodParams.RejectInstall,
    preProtocolStateChannel: StateChannel | undefined,
  ): Promise<MethodResults.RejectInstall> {
    const { store, messagingService, publicIdentifier } = requestHandler;

    const { appIdentityHash, reason } = params;

    const proposal = preProtocolStateChannel!.proposedAppInstances.get(appIdentityHash);

    await store.removeAppProposal(preProtocolStateChannel!.multisigAddress, appIdentityHash);

    const rejectProposalMsg: RejectProposalMessage = {
      from: publicIdentifier,
      type: EventNames.REJECT_INSTALL_EVENT,
      data: {
        appInstance: proposal!,
        reason,
      },
    };

    const { initiatorIdentifier, responderIdentifier } = proposal!;
    const counterparty =
      publicIdentifier === initiatorIdentifier ? responderIdentifier : initiatorIdentifier;

    await messagingService.send(counterparty, rejectProposalMsg);

    return {};
  }
}
