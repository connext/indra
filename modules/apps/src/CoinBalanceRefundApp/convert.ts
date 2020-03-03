import { NumericTypeName, NumericTypes, getType, convertFields } from "@connext/types";
import { CoinBalanceRefundAppState } from "./types";

export function convertCoinBalanceRefund<To extends NumericTypeName>(
  to: To,
  obj: CoinBalanceRefundAppState<any>,
): CoinBalanceRefundAppState<NumericTypes[To]> {
  const fromType = getType(obj.threshold);
  return convertFields(fromType, to, ["threshold"], obj);
}
