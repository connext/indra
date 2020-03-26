import {
  getType,
  NumericTypeName,
  NumericTypes,
  convertAmountField,
  convertCoinTransfers,
  SignedTransferParameters,
  SignedTransferAppState,
} from "@connext/types";

export function convertSignedTransferParameters<To extends NumericTypeName>(
  to: To,
  obj: SignedTransferParameters<any>,
): SignedTransferParameters<NumericTypes[To]> {
  return convertAmountField(to, obj);
}

export function convertSignedTransferAppState<To extends NumericTypeName>(
  to: To,
  obj: SignedTransferAppState<any>,
): SignedTransferAppState<NumericTypes[To]> {
  return {
    ...obj,
    coinTransfers: convertCoinTransfers(to, obj.coinTransfers),
  };
}
