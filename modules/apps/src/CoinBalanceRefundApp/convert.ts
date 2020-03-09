import {
  NumericTypeName,
  NumericTypes,
  getType,
  convertFields,
  CoinBalanceRefundAppState,
} from "@connext/types";

export function convertCoinBalanceRefund<To extends NumericTypeName>(
  to: To,
  obj: CoinBalanceRefundAppState<any>,
): CoinBalanceRefundAppState<NumericTypes[To]> {
  const fromType = getType(obj.threshold);
  return convertFields(fromType, to, ["threshold"], obj);
}
