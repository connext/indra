import {
  NumericTypeName,
  NumericTypes,
  convertAssetAmountWithId,
  HashLockTransferParameters,
  HashLockTransferAppState,
  convertCoinTransfers,
  convertFields,
  getType,
} from "@connext/types";

export function convertHashLockTransferParameters<To extends NumericTypeName>(
  to: To,
  obj: HashLockTransferParameters<any>,
): HashLockTransferParameters<NumericTypes[To]> {
  return convertAssetAmountWithId(to, obj);
}

export function convertHashLockTransferAppState<To extends NumericTypeName>(
  to: To,
  obj: HashLockTransferAppState<any>,
): HashLockTransferAppState<NumericTypes[To]> {
  return convertFields(getType(obj.turnNum), to, ["turnNum"], {
    ...obj,
    coinTransfers: convertCoinTransfers(to, obj.coinTransfers),
  });
}
