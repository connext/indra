import { jsonRpcMethod } from "rpc-server";

import { RequestHandler } from "../../../request-handler";
import { CFCoreTypes } from "../../../types";
import { NodeController } from "../../controller";

export default class GetTokenIndexedFreeBalancesController extends NodeController {
  @jsonRpcMethod(CFCoreTypes.RpcMethodNames.chan_getTokenIndexedFreeBalanceStates)
  public executeMethod = super.executeMethod;

  protected async executeMethodImplementation(
    requestHandler: RequestHandler,
    params: CFCoreTypes.GetTokenIndexedFreeBalanceStatesParams,
  ): Promise<CFCoreTypes.GetTokenIndexedFreeBalanceStatesResult> {
    const { store } = requestHandler;
    const { multisigAddress } = params;

    if (!multisigAddress) {
      throw Error("getTokenIndexedFreeBalanceStates method was given undefined multisigAddress");
    }

    const stateChannel = await store.getStateChannel(multisigAddress);

    return stateChannel.getFreeBalanceClass().toTokenIndexedCoinTransferMap();
  }
}
