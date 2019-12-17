import { jsonRpcMethod } from "rpc-server";

import { CONVENTION_FOR_ETH_TOKEN_ADDRESS } from "../../../constants";
import { RequestHandler } from "../../../request-handler";
import { CFCoreTypes } from "../../../types";
import { NodeController } from "../../controller";

export default class GetFreeBalanceController extends NodeController {
  @jsonRpcMethod(CFCoreTypes.RpcMethodNames.chan_getFreeBalanceState)
  public executeMethod = super.executeMethod;

  protected async executeMethodImplementation(
    requestHandler: RequestHandler,
    params: CFCoreTypes.GetFreeBalanceStateParams
  ): Promise<CFCoreTypes.GetFreeBalanceStateResult> {
    const { store } = requestHandler;
    const { multisigAddress, tokenAddress: tokenAddressParam } = params;

    // NOTE: We default to ETH in case of undefined tokenAddress param
    const tokenAddress = tokenAddressParam || CONVENTION_FOR_ETH_TOKEN_ADDRESS;

    if (!multisigAddress) {
      throw Error(
        "getFreeBalanceState method was given undefined multisigAddress"
      );
    }

    const stateChannel = await store.getStateChannel(multisigAddress);

    return stateChannel.getFreeBalanceClass().withTokenAddress(tokenAddress);
  }
}
