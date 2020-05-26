import { MethodNames, MethodParams, MethodResults } from "@connext/types";

import { NO_STATE_CHANNEL_FOR_MULTISIG_ADDR } from "../../errors";
import { RequestHandler } from "../../request-handler";

import { MethodController } from "../controller";

export class GetProposedAppInstancesController extends MethodController {
  public readonly methodName = MethodNames.chan_getProposedAppInstances;

  protected async executeMethodImplementation(
    requestHandler: RequestHandler,
    params: MethodParams.GetProposedAppInstances,
  ): Promise<MethodResults.GetProposedAppInstances> {
    const { store } = requestHandler;
    const { multisigAddress } = params;

    if (!multisigAddress) {
      throw new Error(`Multisig address is required.`);
    }

    const channel = await store.getStateChannel(multisigAddress);
    if (!channel) {
      throw new Error(NO_STATE_CHANNEL_FOR_MULTISIG_ADDR(multisigAddress));
    }

    return {
      appInstances: channel.proposedAppInstances.map(([id, proposal]) => proposal),
    };
  }
}
