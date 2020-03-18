import {
  NumericTypes,
  convertAmountField,
  NumericTypeName,
  SimpleSwapAppState,
  SwapParameters,
  makeChecksumOrEthAddress,
  convertCoinTransfersToObjIfNeeded
} from "@connext/types";

export function convertSimpleSwapAppState<To extends NumericTypeName>(
  to: To,
  obj: SimpleSwapAppState<any>,
): SimpleSwapAppState<NumericTypes[To]> {
  obj.coinTransfers[0] = convertCoinTransfersToObjIfNeeded(obj.coinTransfers[0]);
  obj.coinTransfers[1] = convertCoinTransfersToObjIfNeeded(obj.coinTransfers[1]);
  return {
    ...obj,
    coinTransfers: [
      convertAmountField(to, obj.coinTransfers[0]),
      convertAmountField(to, obj.coinTransfers[1]),
    ],
  };
}

export function convertSwapParameters<To extends NumericTypeName>(
  to: To,
  obj: SwapParameters<any>,
): SwapParameters<NumericTypes[To]> {
  const asset: any = {
    ...obj,
    fromAssetId: makeChecksumOrEthAddress(obj.fromAssetId),
    toAssetId: makeChecksumOrEthAddress(obj.toAssetId),
  };
  return convertAmountField(to, asset);
}
