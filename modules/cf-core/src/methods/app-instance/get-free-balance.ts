import { MethodNames, MethodParams, MethodResults } from "@connext/types";
import { jsonRpcMethod } from "rpc-server";

import { CONVENTION_FOR_ETH_TOKEN_ADDRESS } from "../../constants";
import { RequestHandler } from "../../request-handler";
import { NodeController } from "../controller";
import { NO_STATE_CHANNEL_FOR_MULTISIG_ADDR } from "../../errors";
import { StateChannel } from "../../models";

export class GetFreeBalanceStateController extends NodeController {
  @jsonRpcMethod(MethodNames.chan_getFreeBalanceState)
  public executeMethod = super.executeMethod;

  protected async executeMethodImplementation(
    requestHandler: RequestHandler,
    params: MethodParams.GetFreeBalanceState,
  ): Promise<MethodResults.GetFreeBalanceState> {
    const { store } = requestHandler;
    const { multisigAddress, tokenAddress: tokenAddressParam } = params;

    // NOTE: We default to ETH in case of undefined tokenAddress param
    const tokenAddress = tokenAddressParam || CONVENTION_FOR_ETH_TOKEN_ADDRESS;

    if (!multisigAddress) {
      throw new Error("getFreeBalanceState method was given undefined multisigAddress");
    }

    const json = await store.getStateChannel(multisigAddress);
    if (!json) {
      throw new Error(NO_STATE_CHANNEL_FOR_MULTISIG_ADDR(multisigAddress));
    }
    const stateChannel = StateChannel.fromJson(json);

    return stateChannel.getFreeBalanceClass().withTokenAddress(tokenAddress);
  }
}
