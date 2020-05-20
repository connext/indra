import { MethodNames, MethodParams, MethodResults } from "@connext/types";
import { jsonRpcMethod } from "rpc-server";

import { RequestHandler } from "../../request-handler";
import { NodeController } from "../controller";
import { StateChannel } from "../../models";
import { NO_STATE_CHANNEL_FOR_MULTISIG_ADDR } from "../../errors";

export class GetTokenIndexedFreeBalancesController extends NodeController {
  @jsonRpcMethod(MethodNames.chan_getTokenIndexedFreeBalanceStates)
  public executeMethod = super.executeMethod;

  protected async executeMethodImplementation(
    requestHandler: RequestHandler,
    params: MethodParams.GetTokenIndexedFreeBalanceStates,
  ): Promise<{ result: MethodResults.GetTokenIndexedFreeBalanceStates }> {
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

    return { result: stateChannel.getFreeBalanceClass().toTokenIndexedCoinTransferMap() };
  }
}
