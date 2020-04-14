import { MethodNames, MethodParams, MethodResults } from "@connext/types";
import { getAddressFromAssetId } from "@connext/utils";
import { getAddress } from "ethers/utils";
import { jsonRpcMethod } from "rpc-server";

import { RequestHandler } from "../../request-handler";
import { NodeController } from "../controller";
import { NO_STATE_CHANNEL_FOR_MULTISIG_ADDR } from "../../errors";
import { StateChannel } from "../../models";
import { AddressZero } from "ethers/constants";

export class GetFreeBalanceStateController extends NodeController {
  @jsonRpcMethod(MethodNames.chan_getFreeBalanceState)
  public executeMethod = super.executeMethod;

  protected async executeMethodImplementation(
    requestHandler: RequestHandler,
    params: MethodParams.GetFreeBalanceState,
  ): Promise<MethodResults.GetFreeBalanceState> {
    const { store } = requestHandler;
    const { multisigAddress, assetId } = params;

    // NOTE: We default to ETH in case of undefined tokenAddress param
    // TODO: standardize on either address or assetId, not both
    const tokenAddress = getAddress(
      ((assetId && assetId.includes("@")) ? getAddressFromAssetId(assetId) : assetId) || AddressZero,
    );
    // console.log(`Parsed params ${JSON.stringify(params)} to address ${tokenAddress}`);

    if (!multisigAddress) {
      throw new Error("getFreeBalanceState method was given undefined multisigAddress");
    }

    const json = await store.getStateChannel(multisigAddress);
    if (!json) {
      throw new Error(NO_STATE_CHANNEL_FOR_MULTISIG_ADDR(multisigAddress));
    }
    const stateChannel = StateChannel.fromJson(json);

    return stateChannel.getFreeBalanceClass()
      .withTokenAddress(tokenAddress);
  }
}
