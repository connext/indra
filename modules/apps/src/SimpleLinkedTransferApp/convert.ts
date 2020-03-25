import {
  NumericTypeName,
  NumericTypes,
  convertAssetAmountWithId,
  LinkedTransferParameters,
  SimpleLinkedTransferAppState,
  convertCoinTransfersToObjIfNeeded,
  convertCoinTransfers,
} from "@connext/types";

export function convertLinkedTransferParameters<To extends NumericTypeName>(
  to: To,
  obj: LinkedTransferParameters<any>,
): LinkedTransferParameters<NumericTypes[To]> {
  return convertAssetAmountWithId(to, obj);
}

export function convertLinkedTransferAppState<To extends NumericTypeName>(
  to: To,
  obj: SimpleLinkedTransferAppState<any>,
): SimpleLinkedTransferAppState<NumericTypes[To]> {
  obj.coinTransfers = convertCoinTransfersToObjIfNeeded(obj.coinTransfers);
  return {
    ...convertAssetAmountWithId(to, obj),
    coinTransfers: convertCoinTransfers(to, obj.coinTransfers),
  };
}
