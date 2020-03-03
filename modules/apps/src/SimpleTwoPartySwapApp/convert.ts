import { NumericTypes, convertAmountField, NumericTypeName } from "@connext/types";
import { SimpleSwapAppState } from "./types";

export function convertSimpleSwapAppState<To extends NumericTypeName>(
  to: To,
  obj: SimpleSwapAppState<any>,
): SimpleSwapAppState<NumericTypes[To]> {
  return {
    ...obj,
    coinTransfers: [
      convertAmountField(to, obj.coinTransfers[0]),
      convertAmountField(to, obj.coinTransfers[1]),
    ],
  };
}
