import { AddressZero } from "ethers/constants";
import { BigNumber, getAddress } from "ethers/utils";

import {
  AppState,
  CoinBalanceRefundAppState,
  CoinTransfer,
  SimpleLinkedTransferAppState,
} from "./app";
import { AssetAmount, PaymentProfile } from "./channel";
import {
  DepositParameters,
  LinkedTransferParameters,
  LinkedTransferToRecipientParameters,
  SwapParameters,
  TransferParameters,
  WithdrawParameters,
} from "./inputs";

/////////////////////////////////////////////
///////// CONVERSION FNS

/////////////////////////////////////////////
////// LOW LEVEL HELPERS
export interface NumericTypes {
  str: string;
  bignumber: BigNumber;
  number: number;
  any: any;
}

export type NumericTypeName = keyof NumericTypes;

const getType = (input: any): NumericTypeName => {
  if (typeof input === "string") return "str";
  if (BigNumber.isBigNumber(input)) return "bignumber";
  if (typeof input === "number") return "number"; // used for testing purposes
  throw new Error(`Unknown input type: ${typeof input}, value: ${JSON.stringify(input)}`);
};

const castFunctions: any = {
  "bignumber-str": (x: BigNumber): string => x.toString(),
  "number-bignumber": (x: number): BigNumber => new BigNumber(x),
  "number-str": (x: number): string => x.toString(),
  "str-bignumber": (x: string): BigNumber => new BigNumber(x),
};

export const convertFields = (
  fromType: NumericTypeName,
  toType: NumericTypeName,
  fields: string[],
  input: any,
): any => {
  if (fromType === toType) return input;

  if (toType === "number") {
    throw new Error("Should not convert fields to numbers");
  }

  let key;
  if (fromType === "number" && toType === "str") {
    key = `bignumber-str`;
  } else if (fromType === "number") {
    key = `str-${toType}`;
  }

  // casting functions same for strs and number types
  const cast = castFunctions[key || [fromType, toType].join("-")];
  if (!cast) throw new Error(`No castFunc for ${fromType} -> ${toType}`);

  const res = { ...input };
  for (const field of fields) {
    const name = field.split("?")[0];
    const isOptional = field.endsWith("?");
    if (isOptional && !(name in input)) continue;
    res[name] = cast(input[name]);
  }
  return res;
};

/////////////////////////////////////////////
////// APP AND CHANNEL TYPE CONVERSIONS
/**
 * Conversion function for AssetAmount or Transfer types. More generally, will
 * work for any types with only the numeric field "amount" with properly added
 * overloading definitions
 */

// will return the address as input if it cannot be checksum-d
// this function does no *explicit* validation on addresses,
// and instead just asserts they are properly checcksum-d
export function makeChecksum(address: string): string {
  try {
    return getAddress(address);
  } catch (e) {
    console.log(
      `Caught error converting address, returning original input value (${address}). Error: ${JSON.stringify(
        e,
        null,
        2,
      )}`,
    );
    return address;
  }
}

// if the address is undefined, uses the AddressZero constant to
// represent the ethereum asset
export function makeChecksumOrEthAddress(address: string | undefined): string {
  if (!address) {
    return AddressZero;
  }
  return makeChecksum(address);
}

type GenericAmountObject<T> = any & {
  amount: T;
};
export function convertAmountField<To extends NumericTypeName>(
  to: To,
  obj: GenericAmountObject<any>,
): GenericAmountObject<NumericTypes[To]> {
  const fromType = getType(obj.amount);
  return convertFields(fromType, to, ["amount"], obj);
}

export function convertAssetAmount<To extends NumericTypeName>(
  to: To,
  obj: AssetAmount<any>,
): AssetAmount<NumericTypes[To]>;
export function convertAssetAmount<To extends NumericTypeName>(
  to: To,
  obj: CoinTransfer<any>,
): CoinTransfer<NumericTypes[To]>;
export function convertAssetAmount<To extends NumericTypeName>(
  to: To,
  obj: AssetAmount<any> | CoinTransfer<any>,
): any {
  return convertAmountField(to, obj);
}

export function convertAssetAmountWithId<To extends NumericTypeName>(
  to: To,
  obj: GenericAmountObject<any> & { assetId?: string },
): any {
  const asset: any = {
    ...obj,
    assetId: makeChecksumOrEthAddress(obj.assetId),
  };
  return convertAssetAmount(to, asset);
}

export function convertPaymentProfile<To extends NumericTypeName>(
  to: To,
  obj: PaymentProfile<any>,
): PaymentProfile<NumericTypes[To]> {
  const fromType = getType(obj.amountToCollateralize);
  return convertFields(fromType, to, ["amountToCollateralize", "minimumMaintainedCollateral"], obj);
}

export function convertCoinBalanceRefund<To extends NumericTypeName>(
  to: To,
  obj: CoinBalanceRefundAppState<any>,
): CoinBalanceRefundAppState<NumericTypes[To]> {
  const fromType = getType(obj.threshold);
  return convertFields(fromType, to, ["threshold"], obj);
}

/////////////////////////////////////////////
////// INPUT PARAMETER CONVERSIONS
/**
 * Conversion function for DepositParameter to an AssetAmount. Will also add
 * in the proper assetId if it is left blank in the supplied parameters to the
 * empty eth address
 */
export function convertDepositParametersToAsset<To extends NumericTypeName>(
  to: To,
  obj: DepositParameters<any>,
): AssetAmount<NumericTypes[To]> {
  return convertAssetAmountWithId(to, obj);
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

export function convertTransferParametersToAsset<To extends NumericTypeName>(
  to: To,
  obj: TransferParameters<any>,
): TransferParameters<NumericTypes[To]> {
  return convertAssetAmountWithId(to, obj);
}

export function convertLinkedTransferParametersToAsset<To extends NumericTypeName>(
  to: To,
  obj: LinkedTransferParameters<any>,
): LinkedTransferParameters<NumericTypes[To]> {
  return convertAssetAmountWithId(to, obj);
}

export function convertLinkedTransferToRecipientParametersToAsset<To extends NumericTypeName>(
  to: To,
  obj: LinkedTransferToRecipientParameters<any>,
): LinkedTransferToRecipientParameters<NumericTypes[To]> {
  return convertAssetAmountWithId(to, obj);
}

export function convertWithdrawParametersToAsset<To extends NumericTypeName>(
  to: To,
  obj: WithdrawParameters<any>,
): WithdrawParameters<NumericTypes[To]> {
  return convertAssetAmountWithId(to, obj);
}

export function convertAppState<To extends NumericTypeName>(
  to: To,
  obj: AppState<any>,
): AppState<NumericTypes[To]> {
  return {
    ...obj,
    coinTransfers: [
      convertAmountField(to, obj.coinTransfers[0]),
      convertAmountField(to, obj.coinTransfers[1]),
    ],
  };
}

export function convertLinkedTransferAppState<To extends NumericTypeName>(
  to: To,
  obj: AppState<any>,
): SimpleLinkedTransferAppState<NumericTypes[To]> {
  return {
    ...convertAmountField(to, obj),
    coinTransfers: [
      convertAmountField(to, obj.coinTransfers[0]),
      convertAmountField(to, obj.coinTransfers[1]),
    ],
  };
}

// DEFINE CONVERSION OBJECT TO BE EXPORTED
export const convert = {
  AppState: convertAppState,
  Asset: convertAssetAmount,
  CoinBalanceRefundApp: convertCoinBalanceRefund,
  Deposit: convertDepositParametersToAsset,
  LinkedTransfer: convertLinkedTransferParametersToAsset,
  LinkedTransferAppState: convertLinkedTransferAppState,
  LinkedTransferToRecipient: convertLinkedTransferToRecipientParametersToAsset,
  PaymentProfile: convertPaymentProfile,
  ResolveLinkedTransfer: convertAssetAmountWithId,
  SimpleTransferAppState: convertAppState,
  SwapAppState: convertAppState,
  SwapParameters: convertSwapParameters,
  Transfer: convertAssetAmount,
  TransferParameters: convertTransferParametersToAsset,
  Withdraw: convertWithdrawParametersToAsset,
};
