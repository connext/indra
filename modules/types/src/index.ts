import { MessagingConfig } from "@connext/messaging";
import { Address, NetworkContext, Node as NodeTypes } from "@counterfactual/types";
import { constants, utils } from "ethers";
import { Network } from "ethers/utils";

////////////////////////////////////
////// BASIC TYPINGS
export type BigNumber = utils.BigNumber;
export const BigNumber = utils.BigNumber;

export type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;

////////////////////////////////////
////// EMITTED EVENTS
// TODO: extend CF types, export their import, rename?
// NOTE: you cannot extend enum types in typescript.
// to "extend" the cf types with our own events, make it a
// const, or use a union type if needed

////////////////////////////////////
////// APP REGISTRY

export const SupportedApplications = {
  SimpleTwoPartySwapApp: "SimpleTwoPartySwapApp",
  UnidirectionalLinkedTransferApp: "UnidirectionalLinkedTransferApp",
  UnidirectionalTransferApp: "UnidirectionalTransferApp",
};
export type SupportedApplication = keyof typeof SupportedApplications;

export const SupportedNetworks = {
  kovan: "kovan",
  mainnet: "mainnet",
};
export type SupportedNetwork = keyof typeof SupportedNetworks;

export type IRegisteredAppDetails = {
  [index in SupportedApplication]: Partial<
    NodeTypes.ProposeInstallVirtualParams & { initialStateFinalized: boolean }
  >;
};

export type RegisteredAppDetails = {
  id: number;
  name: SupportedApplication;
  network: SupportedNetwork;
  outcomeType: number;
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
  channel: NodeChannel;
  appRegistry: RegisteredAppDetails; // TODO: is this right?
  appId: number;
  xpubPartyA: string;
  xpubPartyB: string;
  depositA: T;
  depositB: T;
  intermediaries: string[];
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
// TODO: add swap app
export type AppState<T = string> = UnidirectionalTransferAppState<T>;
export type AppStateBigNumber = AppState<BigNumber>;

// all the types of counterfactual app actions
// TODO: add swap app
export type AppAction<T = string> = UnidirectionalTransferAppAction<T>;
export type AppActionBigNumber = AppAction<BigNumber>;

//////// Swap apps
export type SimpleSwapAppState<T = string> = {
  coinTransfers: CoinTransfer<T>[];
};
export type SimpleSwapAppStateBigNumber = SimpleSwapAppState<BigNumber>;

////// Unidirectional transfer app
export type UnidirectionalTransferAppState<T = string> = {
  finalized: false;
  transfers: [CoinTransfer<T>, CoinTransfer<T>];
  stage: UnidirectionalTransferAppStage;
  turnNum: T;
};
export type UnidirectionalTransferAppStateBigNumber = UnidirectionalTransferAppState<BigNumber>;

export enum UnidirectionalTransferAppActionType {
  SEND_MONEY,
  END_CHANNEL,
}

export type UnidirectionalTransferAppAction<T = string> = {
  actionType: UnidirectionalTransferAppActionType;
  amount: T;
};

export enum UnidirectionalTransferAppStage {
  POST_FUND,
  MONEY_SENT,
  CHANNEL_CLOSED,
}

////// Unidirectional linked transfer app
export type UnidirectionalLinkedTransferAppState<T = string> = {
  stage: UnidirectionalLinkedTransferAppStage;
  transfers: [CoinTransfer<T>, CoinTransfer<T>];
  linkedHash: string;
  turnNum: T;
  finalized: false;
};
export type UnidirectionalLinkedTransferAppStateBigNumber = UnidirectionalLinkedTransferAppState<
  BigNumber
>;

export type UnidirectionalLinkedTransferAppAction<T = string> = {
  amount: T;
  assetId: Address;
  paymentId: string;
  preImage: string;
};

export type UnidirectionalLinkedTransferAppActionBigNumber = UnidirectionalLinkedTransferAppAction<
  BigNumber
>;

export enum UnidirectionalLinkedTransferAppStage {
  POST_FUND,
  PAYMENT_CLAIMED,
  CHANNEL_CLOSED,
}

////////////////////////////////////
////// CHANNEL TYPES

// payment setups
export type PaymentProfile<T = string> = {
  tokenAddress: string;
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
  channels: NodeChannel[];
};

export type NodeChannel = {
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
  freeBalance: NodeTypes.GetFreeBalanceStateResult;
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

export enum KnownNodeAppNames {
  SIMPLE_TWO_PARTY_SWAP = "SimpleTwoPartySwapApp",
  UNIDIRECTIONAL_TRANSFER = "UnidirectionalTransferApp",
  UNIDIRECTIONAL_LINKED_TRANSFER = "UnidirectionalLinkedTransferApp",
}

export type ContractAddresses = NetworkContext & {
  Token: string;
  [KnownNodeAppNames: string]: string;
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

export type GetChannelResponse = NodeChannel;

// returns the transaction hash of the multisig deployment
// TODO: this will likely change
export type CreateChannelResponse = {
  transactionHash: string;
};

export type RequestCollateralResponse = NodeTypes.DepositResult | undefined;

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
  swapRate: T;
  toAssetId: Address;
  fromAssetId: Address;
  // make sure they are consistent with CF stuffs
}
export type SwapParametersBigNumber = SwapParameters<BigNumber>;

////// Withdraw types
export type WithdrawParameters<T = string> = DepositParameters<T> & {
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
  freeBalance: NodeTypes.GetFreeBalanceStateResult;
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
};
export type TransferCondition = keyof typeof TransferConditions;

// linked transfer types
export type LinkedTransferParameters<T = string> = {
  conditionType: "LINKED_TRANSFER";
  amount: T;
  assetId: Address; // make optional?
};
export type LinkedTransferParametersBigNumber = LinkedTransferParameters<BigNumber>;

export type LinkedTransferResponse = {
  paymentId: string;
  preImage: string;
  freeBalance: NodeTypes.GetFreeBalanceStateResult;
};

// FIXME: should be union type of all supported conditions
export type ConditionalTransferParameters<T = string> = LinkedTransferParameters<T>;
export type ConditionalTransferParametersBigNumber = ConditionalTransferParameters<BigNumber>;

// FIXME: should be union type of all supported conditions
export type ConditionalTransferResponse = LinkedTransferResponse;

// condition initial states
// FIXME: should be union type of all supported conditions
export type ConditionalTransferInitialState<T = string> = UnidirectionalLinkedTransferAppState<T>;
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

export function convertMultisig<To extends NumericTypeName>(
  to: To,
  obj: MultisigState<any>,
): MultisigState<NumericTypes[To]> {
  const fromType = getType(obj.freeBalanceA);
  return convertFields(fromType, to, ["freeBalanceA", "freeBalanceB"], obj);
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
  const asset: any = {
    ...obj,
  };
  if (!asset.assetId) {
    asset.assetId = constants.AddressZero;
  }
  return convertAssetAmount(to, asset);
}

export function convertSwapParameters<To extends NumericTypeName>(
  to: To,
  obj: SwapParameters<any>,
): SwapParameters<NumericTypes[To]> {
  const fromType = getType(obj.swapRate);
  return convertFields(fromType, to, ["swapRate", "amount"], obj);
}

export function convertTransferParametersToAsset<To extends NumericTypeName>(
  to: To,
  obj: TransferParameters<any>,
): TransferParameters<NumericTypes[To]> {
  const asset: any = {
    ...obj,
  };
  if (!asset.assetId) {
    asset.assetId = constants.AddressZero;
  }
  return convertAmountField(to, asset);
}

export function convertWithdrawParametersToAsset<To extends NumericTypeName>(
  to: To,
  obj: WithdrawParameters<any>,
): AssetAmount<NumericTypes[To]> {
  const asset: any = {
    ...obj,
  };
  if (!asset.assetId) {
    asset.assetId = constants.AddressZero;
  }
  return convertAmountField(to, asset);
}

export function convertAppState<To extends NumericTypeName>(
  to: To,
  obj: AppState<any>,
): AppState<NumericTypes[To]> {
  return {
    ...obj,
    transfers: [convertAmountField(to, obj.transfers[0]), convertAmountField(to, obj.transfers[1])],
  };
}

// DEFINE CONVERSION OBJECT TO BE EXPORTED
export const convert = {
  AppState: convertAppState,
  Asset: convertAssetAmount,
  Deposit: convertDepositParametersToAsset,
  LinkedTransfer: convertAmountField,
  Multisig: convertMultisig,
  ResolveLinkedTransfer: convertAmountField,
  SwapParameters: convertSwapParameters,
  Transfer: convertAssetAmount,
  TransferParameters: convertTransferParametersToAsset,
  Withdraw: convertWithdrawParametersToAsset,
};
