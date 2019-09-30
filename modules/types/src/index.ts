import { MessagingConfig } from "@connext/messaging";
import { Address, NetworkContext, Node as CFCoreTypes, OutcomeType } from "@counterfactual/types";
import { AddressZero } from "ethers/constants";
import { BigNumber as ethersBig, getAddress, Network } from "ethers/utils";

////////////////////////////////////
////// BASIC TYPINGS
export type BigNumber = ethersBig;
export const BigNumber = ethersBig;

export type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;

export type SolidityValueType = any; // FIXME: use cf type

export const ConnextEvents = CFCoreTypes.EventName;

export const ConnextNodeStorePrefix = "INDRA_NODE_CF_CORE";

export const ConnextClientStorePrefix = "INDRA_CLIENT_CF_CORE";

////////////////////////////////////
////// APP REGISTRY

export const SupportedApplications = {
  SimpleLinkedTransferApp: "SimpleLinkedTransferApp",
  SimpleTransferApp: "SimpleTransferApp",
  SimpleTwoPartySwapApp: "SimpleTwoPartySwapApp",
};
export type SupportedApplication = keyof typeof SupportedApplications;

export const SupportedNetworks = {
  kovan: "kovan",
  mainnet: "mainnet",
};
export type SupportedNetwork = keyof typeof SupportedNetworks;

export type IRegisteredAppDetails = {
  [index in SupportedApplication]: Partial<
    CFCoreTypes.ProposeInstallVirtualParams & { initialStateFinalized: boolean }
  >;
};

export type RegisteredAppDetails = {
  id: number;
  name: SupportedApplication;
  network: SupportedNetwork;
  outcomeType: OutcomeType;
  appDefinitionAddress: string;
  stateEncoding: string;
  actionEncoding: string;
};

export type AppRegistry = RegisteredAppDetails[];

////////////////////////////////////
////// APP TYPES

//////// General
export type App<T = string> = {
  id: number;
  channel: CFCoreChannel;
  appRegistry: RegisteredAppDetails;
  appId: number;
  xpubPartyA: string;
  xpubPartyB: string;
  depositA: T;
  depositB: T;
  intermediary: string;
  initialState: any; // TODO: BAD!!
  timeout: number;
  updates: AppUpdate[];
};
export type AppBigNumber = App<BigNumber>;

export type AppUpdate<T = string> = {
  id: number;
  app: App<T>;
  action: any; // TODO: BAD!!
  sigs: string[];
};
export type AppUpdateBigNumber = AppUpdate<BigNumber>;

export type CoinTransfer<T = string> = {
  amount: T;
  to: Address; // NOTE: must be the xpub!!!
};
export type CoinTransferBigNumber = CoinTransfer<BigNumber>;

// all the types of counterfactual app states
export type AppState<T = string> =
  | SimpleTransferAppState<T>
  | SimpleLinkedTransferAppState<T>
  | SimpleSwapAppState<T>;
export type AppStateBigNumber = AppState<BigNumber>;

// all the types of counterfactual app actions
export type AppAction<T = string> = SimpleLinkedTransferAppAction | SolidityValueType;
export type AppActionBigNumber = AppAction<BigNumber> | SolidityValueType;

//////// Swap apps
export type SimpleSwapAppState<T = string> = {
  coinTransfers: CoinTransfer<T>[][];
};
export type SimpleSwapAppStateBigNumber = SimpleSwapAppState<BigNumber>;

//////// Simple transfer app
export type SimpleTransferAppState<T = string> = {
  coinTransfers: CoinTransfer<T>[];
};
export type SimpleTransferAppStateBigNumber = SimpleTransferAppState<BigNumber>;

//////// Simple linked transfer app
export type SimpleLinkedTransferAppState<T = string> = {
  coinTransfers: CoinTransfer<T>[];
  linkedHash: string;
  amount: T;
  assetId: string;
  paymentId: string;
  preImage: string;
};
export type SimpleLinkedTransferAppStateBigNumber = SimpleLinkedTransferAppState<BigNumber>;
export type SimpleLinkedTransferAppAction = {
  preImage: string;
};

////////////////////////////////////
////// CHANNEL TYPES

// used to verify channel is in sequence
export type ChannelAppSequences = {
  userAppSequenceNumber: number;
  nodeAppSequenceNumber: number;
};

// payment setups
export type PaymentProfile<T = string> = {
  assetId: string;
  minimumMaintainedCollateral: T;
  amountToCollateralize: T;
};
export type PaymentProfileBigNumber = PaymentProfile<BigNumber>;

// asset types
export interface AssetAmount<T = string> {
  amount: T;
  assetId: Address; // empty address if eth
}
export type AssetAmountBigNumber = AssetAmount<BigNumber>;

export type User = {
  id: number;
  xpub: string;
  channels: CFCoreChannel[];
};

export type CFCoreChannel = {
  id: number;
  nodePublicIdentifier: string;
  userPublicIdentifier: string;
  multisigAddress: string;
  available: boolean;
};
export type Channel<T = string> = {
  id: number;
  user: User;
  counterpartyXpub: string;
  multisigAddress: string;
  apps: App<T>[];
  updates: ChannelUpdate<T>[];
};
export type ChannelBigNumber = Channel<BigNumber>;

export type ChannelUpdate<T = string> = {
  id: number;
  channel: Channel<T>;
  freeBalancePartyA: T;
  freeBalancePartyB: T;
  nonce: number;
  sigPartyA: string;
  sigPartyB: string;
};
export type ChannelUpdateBigNumber = ChannelUpdate<BigNumber>;

export type ChannelState<T = string> = {
  apps: AppState<T>[];
  // TODO: CF types should all be generic, this will be
  // a BigNumber
  freeBalance: CFCoreTypes.GetFreeBalanceStateResult;
};
export type ChannelStateBigNumber = ChannelState<BigNumber>;

export type TransferAction = {
  finalize: boolean;
  transferAmount: BigNumber;
};

// TODO: define properly!!
export type ChannelProvider = any;

export type MultisigState<T = string> = {
  id: number;
  xpubA: string;
  xpubB: string;
  multisigAddress: string;
  freeBalanceA: T;
  freeBalanceB: T;
  appIds: number[];
};
export type MultisigStateBigNumber = MultisigState<BigNumber>;

////////////////////////////////////
///////// NODE RESPONSE TYPES

export type ContractAddresses = NetworkContext & {
  Token: string;
  [KnownNodeApp: string]: string;
};

export interface NodeConfig {
  nodePublicIdentifier: string; // x-pub of node
  chainId: string; // network that your channel is on
  nodeUrl: string;
}

// nats stuff
type successResponse = {
  status: "success";
};

type errorResponse = {
  status: "error";
  message: string;
};

export type NatsResponse = {
  data: string;
} & (errorResponse | successResponse);

export type GetConfigResponse = {
  ethNetwork: Network;
  contractAddresses: ContractAddresses;
  nodePublicIdentifier: string;
  messaging: MessagingConfig;
};

export type GetChannelResponse = CFCoreChannel;

// returns the transaction hash of the multisig deployment
// TODO: this will likely change
export type CreateChannelResponse = {
  transactionHash: string;
};

export type RequestCollateralResponse = CFCoreTypes.DepositResult | undefined;

/////////////////////////////////
///////// SWAP
export type AllowedSwap = {
  from: string;
  to: string;
};

export type SwapRate = AllowedSwap & {
  rate: string;
};

/////////////////////////////////
///////// CLIENT INPUT TYPES

////// Deposit types
// TODO: we should have a way to deposit multiple things
export type DepositParameters<T = string> = Omit<AssetAmount<T>, "assetId"> & {
  assetId?: Address; // if not supplied, assume it is eth
};
export type DepositParametersBigNumber = DepositParameters<BigNumber>;

////// Transfer types
// TODO: would we ever want to pay people in the same app with multiple currencies?
export type TransferParameters<T = string> = DepositParameters<T> & {
  recipient: Address;
  meta?: any; // TODO: meta types? should this be a string
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
export type ResolveLinkedTransferParameters<T = string> = LinkedTransferParameters<T> & {
  paymentId: string;
  preImage: string;
};
export type ResolveLinkedTransferResponse = {
  freeBalance: CFCoreTypes.GetFreeBalanceStateResult;
  paymentId: string;
};

// resolver union types
// FIXME: should be union type of all supported conditions
export type ResolveConditionParameters<T = string> = ResolveLinkedTransferParameters;

// FIXME: should be union type of all supported conditions
export type ResolveConditionResponse<T = string> = ResolveLinkedTransferResponse;

///// Conditional transfer types

// TODO: maybe not an enum?
export const TransferConditions = {
  LINKED_TRANSFER: "LINKED_TRANSFER",
  LINKED_TRANSFER_TO_RECIPIENT: "LINKED_TRANSFER_TO_RECIPIENT",
};
export type TransferCondition = keyof typeof TransferConditions;

// linked transfer types
export type LinkedTransferParameters<T = string> = {
  conditionType: TransferCondition;
  amount: T;
  assetId?: Address;
  paymentId: string;
  preImage: string;
};
export type LinkedTransferParametersBigNumber = LinkedTransferParameters<BigNumber>;

export type LinkedTransferResponse = {
  paymentId: string;
  preImage: string;
  freeBalance: CFCoreTypes.GetFreeBalanceStateResult;
};

export type LinkedTransferToRecipientParameters<T = string> = LinkedTransferParameters<T> & {
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
  | LinkedTransferToRecipientParameters<T>;
export type ConditionalTransferParametersBigNumber = ConditionalTransferParameters<BigNumber>;

export type ConditionalTransferResponse =
  | LinkedTransferResponse
  | LinkedTransferToRecipientResponse;

// condition initial states
// FIXME: should be union type of all supported conditions
export type ConditionalTransferInitialState<T = string> = SimpleLinkedTransferAppState<T>;
// FIXME: should be union type of all supported conditions
export type ConditionalTransferInitialStateBigNumber = ConditionalTransferInitialState<BigNumber>;

/////////////////////////////////
///////// CONVERSION FNS

////// LOW LEVEL HELPERS
export interface NumericTypes {
  str: string;
  bignumber: BigNumber;
  number: number;
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
    console.log("Caught error converting address, returning original input value.");
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

export function convertMultisig<To extends NumericTypeName>(
  to: To,
  obj: MultisigState<any>,
): MultisigState<NumericTypes[To]> {
  const fromType = getType(obj.freeBalanceA);
  return convertFields(fromType, to, ["freeBalanceA", "freeBalanceB"], obj);
}

export function convertPaymentProfile<To extends NumericTypeName>(
  to: To,
  obj: PaymentProfile<any>,
): PaymentProfile<NumericTypes[To]> {
  const fromType = getType(obj.amountToCollateralize);
  return convertFields(fromType, to, ["amountToCollateralize", "minimumMaintainedCollateral"], obj);
}

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
    // transfers: [convertAmountField(to, obj.transfers[0]), convertAmountField(to, obj.transfers[1])],
  };
}

// DEFINE CONVERSION OBJECT TO BE EXPORTED
export const convert = {
  AppState: convertAppState,
  Asset: convertAssetAmount,
  Deposit: convertDepositParametersToAsset,
  LinkedTransfer: convertLinkedTransferParametersToAsset,
  LinkedTransferToRecipient: convertLinkedTransferToRecipientParametersToAsset,
  Multisig: convertMultisig,
  PaymentProfile: convertPaymentProfile,
  ResolveLinkedTransfer: convertAssetAmountWithId,
  SwapParameters: convertSwapParameters,
  Transfer: convertAssetAmount,
  TransferParameters: convertTransferParametersToAsset,
  Withdraw: convertWithdrawParametersToAsset,
};
