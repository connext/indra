import {
  NumericTypeName,
  LinkedTransferParameters,
  NumericTypes,
  convertAssetAmountWithId,
  LinkedTransferToRecipientParameters,
} from "@connext/types";

export function convertLinkedTransferParameters<To extends NumericTypeName>(
  to: To,
  obj: LinkedTransferParameters<any>,
): LinkedTransferParameters<NumericTypes[To]> {
  return convertAssetAmountWithId(to, obj);
}

export function convertLinkedTransferToRecipientParameters<To extends NumericTypeName>(
  to: To,
  obj: LinkedTransferToRecipientParameters<any>,
): LinkedTransferToRecipientParameters<NumericTypes[To]> {
  return convertAssetAmountWithId(to, obj);
}
