import {
  getType,
  NumericTypeName,
  NumericTypes,
  convertFields,
  convertAmountField,
} from "@connext/types";

import { FastSignedTransferParameters, FastSignedTransferAppState } from "./types";

export function convertFastSignedTransferParameters<To extends NumericTypeName>(
  to: To,
  obj: FastSignedTransferParameters<any>,
): FastSignedTransferParameters<NumericTypes[To]> {
  const fromType = getType(obj.amount);
  return convertFields(fromType, to, ["maxAllocation", "amount"], obj);
}

export function convertFastSignedTransferAppState<To extends NumericTypeName>(
  to: To,
  obj: FastSignedTransferAppState<any>,
): FastSignedTransferAppState<NumericTypes[To]> {
  return {
    ...obj,
    coinTransfers: [
      convertAmountField(to, obj.coinTransfers[0]),
      convertAmountField(to, obj.coinTransfers[1]),
    ],
    lockedPayments: obj.lockedPayments.map(lockedPayment => convertAmountField(to, lockedPayment)),
  };
}
