import { SimpleLinkedTransferAppState } from "./app";
import { Address, BigNumber } from "./basic";
import { AssetAmount } from "./channel";
import { ProtocolTypes } from "./protocol";

// REFACTOR START
// TODO: import all signatureTransferTypes (will only need the ones used by conditional types)
import {
  SignatureTransferParameters,
  SignatureTransferParametersBigNumber,
  SignatureTransferResponse,
  ResolveSignatureTransferParameters,
  ResolveSignatureTransferParametersBigNumber,
  ResolveSignatureTransferParametersResponse,
} from "./app/signatureTransferInputs";

// TODO: export all signatureTransferTypes (not need if we import directly into index)
export {
  SignatureTransferParameters,
  SignatureTransferParametersBigNumber,
  SignatureTransferResponse,
  ResolveSignatureTransferParameters,
  ResolveSignatureTransferParametersBigNumber,
  ResolveSignatureTransferParametersResponse,
};

import {
  LINKED_TRANSFER,
  LINKED_TRANSFER_TO_RECIPIENT,
  TransferCondition,
} from "./app/transferInputsDefaults";

////// Transfer types
export { LINKED_TRANSFER, LINKED_TRANSFER_TO_RECIPIENT, TransferCondition };

/////////////////////////////////
///////// SWAP
export type AllowedSwap = {
  from: string;
  to: string;
};

export const PriceOracleTypes = {
  UNISWAP: "UNISWAP",
};

export type PriceOracleType = keyof typeof PriceOracleTypes;

export type SwapRate = AllowedSwap & {
  rate: string;
  priceOracleType: PriceOracleType;
  blockNumber?: number;
};

/////////////////////////////////
///////// CLIENT INPUT TYPES

////// Deposit types
// TODO: we should have a way to deposit multiple things
export type DepositParameters<T = string> = Omit<AssetAmount<T>, "assetId"> & {
  assetId?: Address; // if not supplied, assume it is eth
};
export type DepositParametersBigNumber = DepositParameters<BigNumber>;

export type RequestDepositRightsParameters = Omit<DepositParameters, "amount">;

export type RequestDepositRightsResponse = ProtocolTypes.RequestDepositRightsResult;

export type CheckDepositRightsParameters = RequestDepositRightsParameters;

export type CheckDepositRightsResponse<T = string> = {
  assetId: Address;
  multisigBalance: T;
  recipient: Address;
  threshold: T;
};

export type RescindDepositRightsParameters = RequestDepositRightsParameters;

export type RescindDepositRightsResponse = ProtocolTypes.DepositResult;

// TODO: would we ever want to pay people in the same app with multiple currencies?
export type TransferParameters<T = string> = DepositParameters<T> & {
  recipient: Address;
  meta?: object;
};
export type TransferParametersBigNumber = TransferParameters<BigNumber>;

////// Swap types
// TODO: would we ever want to pay people in the same app with multiple currencies?
export interface SwapParameters<T = string> {
  amount: T;
  swapRate: string;
  toAssetId: Address;
  fromAssetId: Address;
  // make sure they are consistent with CF stuffs
}
export type SwapParametersBigNumber = SwapParameters<BigNumber>;

////// Withdraw types
export type WithdrawParameters<T = string> = DepositParameters<T> & {
  userSubmitted?: boolean;
  recipient?: Address; // if not provided, will default to signer addr
};
export type WithdrawParametersBigNumber = WithdrawParameters<BigNumber>;

///// Resolve condition types

// linked transfer
export type ResolveLinkedTransferParameters<T = string> = Omit<
  LinkedTransferParameters<T>,
  "amount" | "assetId" | "meta"
>;
export type ResolveLinkedTransferParametersBigNumber = ResolveLinkedTransferParameters<BigNumber>;

export type ResolveLinkedTransferToRecipientParameters<T = string> = Omit<
  ResolveLinkedTransferParameters<T>,
  "recipient" | "conditionType"
> & {
  amount: T;
  assetId: string;
  conditionType: typeof LINKED_TRANSFER_TO_RECIPIENT;
};

export type ResolveLinkedTransferToRecipientParametersBigNumber = ResolveLinkedTransferToRecipientParameters<
  BigNumber
>;

// resolver union types
export type ResolveConditionParameters<T = string> =
  | ResolveLinkedTransferParameters<T>
  | ResolveLinkedTransferToRecipientParameters<T>;

export type ResolveLinkedTransferResponse = {
  appId: string;
  freeBalance: ProtocolTypes.GetFreeBalanceStateResult;
  paymentId: string;
  meta?: object;
};

// FIXME: should be union type of all supported conditions
export type ResolveConditionResponse = ResolveLinkedTransferResponse;

// linked transfer types
export type LinkedTransferParameters<T = string> = {
  conditionType: typeof LINKED_TRANSFER;
  amount: T;
  assetId?: Address;
  paymentId: string;
  preImage: string;
  meta?: object;
};
export type LinkedTransferParametersBigNumber = LinkedTransferParameters<BigNumber>;

export type LinkedTransferResponse = {
  paymentId: string;
  preImage: string;
  freeBalance: ProtocolTypes.GetFreeBalanceStateResult;
  meta?: object;
};

export type LinkedTransferToRecipientParameters<T = string> = Omit<
  LinkedTransferParameters<T>,
  "conditionType"
> & {
  conditionType: typeof LINKED_TRANSFER_TO_RECIPIENT;
  recipient: string;
};
export type LinkedTransferToRecipientParametersBigNumber = LinkedTransferToRecipientParameters<
  BigNumber
>;
export type LinkedTransferToRecipientResponse = LinkedTransferResponse & {
  recipient: string;
};

export type ConditionalTransferParameters<T = string> =
  | LinkedTransferParameters<T>
  | LinkedTransferToRecipientParameters<T>
  | SignatureTransferParameters<T>;

export type ConditionalTransferParametersBigNumber = ConditionalTransferParameters<BigNumber>;

export type ConditionalTransferResponse =
  | LinkedTransferResponse
  | LinkedTransferToRecipientResponse
  | ResolveSignatureTransferParametersResponse;

// condition initial states
// FIXME: should be union type of all supported conditions
export type ConditionalTransferInitialState<T = string> = SimpleLinkedTransferAppState<T>;
// FIXME: should be union type of all supported conditions
export type ConditionalTransferInitialStateBigNumber = ConditionalTransferInitialState<BigNumber>;
