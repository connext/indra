import { MethodNames, MethodParams, MethodResults } from "@connext/types";

import { NO_STATE_CHANNEL_FOR_MULTISIG_ADDR } from "../../errors";
import { StateChannel } from "../../models";
import { RequestHandler } from "../../request-handler";

import { MethodController } from "../controller";

export class GetTokenIndexedFreeBalancesController extends MethodController {
  public readonly methodName = MethodNames.chan_getTokenIndexedFreeBalanceStates;

  public executeMethod = super.executeMethod;

  protected async executeMethodImplementation(
    requestHandler: RequestHandler,
    params: MethodParams.GetTokenIndexedFreeBalanceStates,
  ): Promise<MethodResults.GetTokenIndexedFreeBalanceStates> {
    const { store } = requestHandler;
    const { multisigAddress } = params;

    if (!multisigAddress) {
      throw new Error(
        `getTokenIndexedFreeBalanceStates method was given undefined multisigAddress`,
      );
    }

    const json = await store.getStateChannel(multisigAddress);
    if (!json) {
      throw new Error(NO_STATE_CHANNEL_FOR_MULTISIG_ADDR(multisigAddress));
    }
    const stateChannel = StateChannel.fromJson(json);

    return stateChannel.getFreeBalanceClass().toTokenIndexedCoinTransferMap();
  }
}
