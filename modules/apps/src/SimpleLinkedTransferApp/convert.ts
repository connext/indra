import {
  NumericTypeName,
  NumericTypes,
  convertAssetAmountWithId,
  LinkedTransferParameters,
  LinkedTransferToRecipientParameters,
  ResolveLinkedTransferParameters,
  ResolveLinkedTransferToRecipientParameters,
  SimpleLinkedTransferAppState,
  convertAmountField,
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

export function convertResolveLinkedTransferParameters<To extends NumericTypeName>(
  to: To,
  obj: ResolveLinkedTransferParameters<any>,
): ResolveLinkedTransferParameters<NumericTypes[To]> {
  return convertAssetAmountWithId(to, obj);
}

export function convertResolveLinkedTransferToRecipientParameters<To extends NumericTypeName>(
  to: To,
  obj: ResolveLinkedTransferToRecipientParameters<any>,
): ResolveLinkedTransferToRecipientParameters<NumericTypes[To]> {
  return convertAssetAmountWithId(to, obj);
}

export function convertLinkedTransferAppState<To extends NumericTypeName>(
  to: To,
  obj: SimpleLinkedTransferAppState<any>,
): SimpleLinkedTransferAppState<NumericTypes[To]> {
  return convertAssetAmountWithId(to, {
    ...obj,
    coinTransfers: [
      convertAmountField(to, obj.coinTransfers[0]),
      convertAmountField(to, obj.coinTransfers[1]),
    ],
  });
}
