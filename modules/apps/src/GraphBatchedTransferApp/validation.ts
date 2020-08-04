import { BigNumber, utils } from "ethers";
import { ProtocolParams, Address, GraphBatchedTransferAppState } from "@connext/types";

import { validateSignedTransferApp } from "../SimpleSignedTransferApp";

const ALLOWED_DISCREPANCY_PCT = 5;

export const validateGraphBatchedTransferApp = async (
  params: ProtocolParams.Propose,
  getSwapRate: (fromTokenAddress: Address, toTokenAddress: Address) => Promise<string>,
): Promise<void> => {
  // basic validation
  validateSignedTransferApp(params);
  // swap rate validation
  const { meta, initiatorDepositAssetId, initialState } = params;

  let ourRate: string;
  if (!meta?.senderAssetId || meta?.senderAssetId === initiatorDepositAssetId) {
    // no swap detected
    ourRate = "1";
  } else {
    ourRate = await getSwapRate(meta?.senderAssetId, initiatorDepositAssetId);
  }

  const expectedRate = utils.parseUnits(ourRate, 18);
  const givenRate = (initialState as GraphBatchedTransferAppState).swapRate;

  // make sure calculated within allowed amount
  const calculatedToActualDiscrepancy = expectedRate.sub(givenRate).abs();
  // i.e. (x * (100 - 5)) / 100 = 0.95 * x
  const allowedDiscrepancy = expectedRate
    .mul(BigNumber.from(100).sub(ALLOWED_DISCREPANCY_PCT))
    .div(100);

  if (calculatedToActualDiscrepancy.gt(allowedDiscrepancy)) {
    throw new Error(
      `Given rate ${givenRate.toString()} is out of range of our expected rate (${expectedRate.toString()})} by more than ${ALLOWED_DISCREPANCY_PCT}% (discrepancy: ${calculatedToActualDiscrepancy.toString()})`,
    );
  }
};
