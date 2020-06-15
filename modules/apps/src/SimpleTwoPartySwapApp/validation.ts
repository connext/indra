import { AllowedSwap, SwapRate, ProtocolParams } from "@connext/types";
import { calculateExchange, getAddressFromAssetId, stringify } from "@connext/utils";
import { BigNumber } from "ethers";

const ALLOWED_DISCREPANCY_PCT = 5;

export const validateSimpleSwapApp = (
  params: ProtocolParams.Propose,
  allowedSwaps: SwapRate[],
  ourRate: string,
) => {
  const {
    responderDeposit,
    initiatorDeposit,
    initiatorDepositAssetId,
    responderDepositAssetId,
  } = params;

  const initiatorDepositTokenAddress = getAddressFromAssetId(initiatorDepositAssetId);
  const responderDepositTokenAddress = getAddressFromAssetId(responderDepositAssetId);

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
    .mul(BigNumber.from(100).sub(ALLOWED_DISCREPANCY_PCT))
    .div(100);

  if (calculatedToActualDiscrepancy.gt(allowedDiscrepancy)) {
    throw new Error(
      `Responder deposit (${responderDeposit.toString()}) is greater than our expected deposit (${calculated.toString()}) based on our swap rate ${ourRate} by more than ${ALLOWED_DISCREPANCY_PCT}% (discrepancy: ${calculatedToActualDiscrepancy.toString()})`,
    );
  }
};
