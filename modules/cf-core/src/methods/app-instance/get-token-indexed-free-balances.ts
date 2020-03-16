import { MethodNames, MethodParams, MethodResults } from "@connext/types";
import { jsonRpcMethod } from "rpc-server";

import { RequestHandler } from "../../request-handler";
import { NodeController } from "../controller";

export class GetTokenIndexedFreeBalancesController extends NodeController {
  @jsonRpcMethod(MethodNames.chan_getTokenIndexedFreeBalanceStates)
  public executeMethod = super.executeMethod;

  protected async executeMethodImplementation(
    requestHandler: RequestHandler,
    params: MethodParams.GetTokenIndexedFreeBalanceStates,
  ): Promise<MethodResults.GetTokenIndexedFreeBalanceStates> {
    const { store } = requestHandler;
    const { multisigAddress } = params;

    if (!multisigAddress) {
      throw Error(`getTokenIndexedFreeBalanceStates method was given undefined multisigAddress`);
    }

    const stateChannel = await store.getStateChannel(multisigAddress);

    return stateChannel.getFreeBalanceClass().toTokenIndexedCoinTransferMap();
  }
}
