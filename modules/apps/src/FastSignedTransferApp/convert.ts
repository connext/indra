import {
  getType,
  NumericTypeName,
  NumericTypes,
  convertFields,
  convertAmountField,
  FastSignedTransferParameters,
  FastSignedTransferAppState,
  convertCoinTransfers,
} from "@connext/types";

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
    coinTransfers: convertCoinTransfers(to, obj.coinTransfers),
    ...convertAmountField(to, obj),
  };
}
