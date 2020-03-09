import {
    NumericTypes,
    convertAmountField,
    NumericTypeName,
    WithdrawAppState,
    WithdrawParameters,
    makeChecksumOrEthAddress,
  } from "@connext/types";

export function convertWithrawAppState<To extends NumericTypeName>(
  to: To,
  obj: WithdrawAppState<any>,
): WithdrawAppState<NumericTypes[To]> {
  return {
    ...obj,
    transfers: [
      convertAmountField(to, obj.transfers[0]),
      convertAmountField(to, obj.transfers[1]),
    ],
  };
}

export function convertWithdrawParameters<To extends NumericTypeName>(
  to: To,
  obj: WithdrawParameters<any>,
): WithdrawParameters<NumericTypes[To]> {
  const asset: any = {
    ...obj,
    assetId: makeChecksumOrEthAddress(obj.assetId),
  };
  return convertAmountField(to, asset);
}
