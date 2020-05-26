import {
  MethodNames,
  MethodParams,
  MethodResults,
  CONVENTION_FOR_ETH_ASSET_ID,
} from "@connext/types";
import { getAddressFromAssetId } from "@connext/utils";
import { utils } from "ethers";

import { NO_STATE_CHANNEL_FOR_MULTISIG_ADDR } from "../../errors";
import { StateChannel } from "../../models";
import { RequestHandler } from "../../request-handler";

import { MethodController } from "../controller";

const { getAddress } = utils;

export class GetFreeBalanceStateController extends MethodController {
  public readonly methodName = MethodNames.chan_getFreeBalanceState;

  public executeMethod = super.executeMethod;

  protected async executeMethodImplementation(
    requestHandler: RequestHandler,
    params: MethodParams.GetFreeBalanceState,
  ): Promise<MethodResults.GetFreeBalanceState> {
    const { store } = requestHandler;
    const { multisigAddress, assetId } = params;

    // NOTE: We default to ETH in case of undefined tokenAddress param
    // TODO: standardize on either address or assetId, not both
    const tokenAddress = getAddress(getAddressFromAssetId(assetId || CONVENTION_FOR_ETH_ASSET_ID));

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
