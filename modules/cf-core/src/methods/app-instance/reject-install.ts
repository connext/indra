import {
  EventNames,
  MethodNames,
  MethodParams,
  MethodResults,
  RejectProposalMessage,
} from "@connext/types";

import { NO_STATE_CHANNEL_FOR_APP_IDENTITY_HASH, NO_MULTISIG_IN_PARAMS } from "../../errors";
import { StateChannel } from "../../models/state-channel";
import { RequestHandler } from "../../request-handler";

import { MethodController } from "../controller";

export class RejectInstallController extends MethodController {
  public readonly methodName = MethodNames.chan_rejectInstall;

  public executeMethod = super.executeMethod;
  protected async getRequiredLockNames(
    requestHandler: RequestHandler,
    params: MethodParams.RejectInstall,
  ): Promise<string[]> {
    if (!params.multisigAddress) {
      throw new Error(NO_MULTISIG_IN_PARAMS(params));
    }
    return [params.multisigAddress];
  }

  protected async beforeExecution(
    requestHandler: RequestHandler,
    params: MethodParams.RejectInstall,
    preProtocolStateChannel: StateChannel | undefined,
  ): Promise<MethodResults.RejectInstall | undefined> {
    const { appIdentityHash } = params;
    if (!preProtocolStateChannel) {
      throw new Error(NO_STATE_CHANNEL_FOR_APP_IDENTITY_HASH(appIdentityHash));
    }
    const proposal = preProtocolStateChannel.proposedAppInstances.get(appIdentityHash);
    if (!proposal) {
      return {};
    }
    return undefined;
  }

  protected async executeMethodImplementation(
    requestHandler: RequestHandler,
    params: MethodParams.RejectInstall,
    preProtocolStateChannel: StateChannel | undefined,
  ): Promise<MethodResults.RejectInstall> {
    const { store, messagingService, publicIdentifier } = requestHandler;

    if (!preProtocolStateChannel) {
      throw new Error("Could not find state channel in store to begin reject install with");
    }

    const { appIdentityHash, reason } = params;

    const proposal = preProtocolStateChannel.proposedAppInstances.get(appIdentityHash);

    if (!proposal) {
      return {};
    }

    await store.removeAppProposal(
      preProtocolStateChannel.multisigAddress,
      appIdentityHash,
      preProtocolStateChannel.removeProposal(appIdentityHash).toJson(),
    );

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
