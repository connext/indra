import { AllowedSwap, ProtocolParams } from "@connext/types";
import { calculateExchangeWad, getAddressFromAssetId, stringify } from "@connext/utils";
import { BigNumber } from "ethers";

const ALLOWED_DISCREPANCY_PCT = 5;

export const validateSimpleSwapApp = (
  params: ProtocolParams.Propose,
  allowedSwaps: AllowedSwap[],
  ourRate: string,
  responderDecimals: number,
) => {
  const {
    responderDeposit,
    initiatorDeposit,
    initiatorDepositAssetId,
    responderDepositAssetId,
  } = params;

  const initiatorDecimals = 18;

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

  const calculatedResponderDeposit = calculateExchangeWad(
    initiatorDeposit,
    initiatorDecimals,
    ourRate,
    responderDecimals,
  );

  // make sure calculated within allowed amount
  const calculatedToActualDiscrepancy = calculatedResponderDeposit.sub(responderDeposit).abs();
  // i.e. (x * (100 - 5)) / 100 = 0.95 * x
  const allowedDiscrepancy = calculatedResponderDeposit
    .mul(BigNumber.from(100).sub(ALLOWED_DISCREPANCY_PCT))
    .div(100);

  if (calculatedToActualDiscrepancy.gt(allowedDiscrepancy)) {
    throw new Error(
      `Responder deposit (${responderDeposit.toString()}) is greater than our expected deposit (${calculatedResponderDeposit.toString()}) based on our swap rate ${ourRate} by more than ${ALLOWED_DISCREPANCY_PCT}% (discrepancy: ${calculatedToActualDiscrepancy.toString()})`,
    );
  }
};
