import {
  MethodParams,
  AllowedSwap,
  calculateExchange,
  OutcomeType,
  SimpleSwapAppStateEncoding,
  SimpleTwoPartySwapAppName,
  stringify,
  SwapRate,
} from "@connext/types";
import { bigNumberify } from "ethers/utils";

import { AppRegistryInfo } from "./shared";

const ALLOWED_DISCREPANCY_PCT = 5;

export const SimpleTwoPartySwapAppRegistryInfo: AppRegistryInfo = {
  allowNodeInstall: true,
  name: SimpleTwoPartySwapAppName,
  outcomeType: OutcomeType.MULTI_ASSET_MULTI_PARTY_COIN_TRANSFER,
  stateEncoding: SimpleSwapAppStateEncoding,
};

export const validateSimpleSwapApp = (
  params: MethodParams.ProposeInstall,
  allowedSwaps: SwapRate[],
  ourRate: string,
) => {
  const {
    responderDeposit,
    initiatorDeposit,
    initiatorDepositTokenAddress,
    responderDepositTokenAddress,
  } = params;

  if (
    !allowedSwaps.find(
      (swap: AllowedSwap) =>
        swap.from === initiatorDepositTokenAddress && swap.to === responderDepositTokenAddress,
    )
  ) {
    throw new Error(
      `Swap from ${initiatorDepositTokenAddress} to ${responderDepositTokenAddress} is not valid. Valid swaps: ${stringify(
        allowedSwaps,
      )}`,
    );
  }

  const calculated = calculateExchange(initiatorDeposit, ourRate);

  // make sure calculated within allowed amount
  const calculatedToActualDiscrepancy = calculated.sub(responderDeposit).abs();
  // i.e. (x * (100 - 5)) / 100 = 0.95 * x
  const allowedDiscrepancy = calculated
    .mul(bigNumberify(100).sub(ALLOWED_DISCREPANCY_PCT))
    .div(100);

  if (calculatedToActualDiscrepancy.gt(allowedDiscrepancy)) {
    throw new Error(
      `Responder deposit (${responderDeposit.toString()}) is greater than our expected deposit (${calculated.toString()}) based on our swap rate ${ourRate} by more than ${ALLOWED_DISCREPANCY_PCT}% (discrepancy: ${calculatedToActualDiscrepancy.toString()})`,
    );
  }
};
