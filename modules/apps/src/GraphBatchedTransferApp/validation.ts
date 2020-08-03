import { BigNumber } from "ethers";
import { ProtocolParams, Address } from "@connext/types";
import { calculateExchangeWad } from "@connext/utils";

import { validateSignedTransferApp } from "../SimpleSignedTransferApp";

const ALLOWED_DISCREPANCY_PCT = 5;

export const validateGraphBatchedTransferApp = async (
  params: ProtocolParams.Propose,
  getSwapRate: (fromTokenAddress: Address, toTokenAddress: Address) => Promise<string>,
): Promise<void> => {
  // basic validation
  validateSignedTransferApp(params);
  // swap rate validation
  const { responderDeposit, initiatorDeposit, meta, initiatorDepositAssetId } = params;

  if (meta?.senderAssetId === initiatorDepositAssetId) {
    // no swap detected
    return;
  }

  // TODO: will need to fix this eventually
  const initiatorDecimals = 18;
  const responderDecimals = 18;

  const ourRate = await getSwapRate(meta?.senderAssetId, initiatorDepositAssetId);

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
