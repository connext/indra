// import { Address, NetworkContext, Node as NodeTypes, OutcomeType } from "@counterfactual/types";
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

// app name : deployed address
// TODO: use deployed addresses!!!
// TODO: better way to use with networks...?
// TODO: rename? cf has type ABIEncoding = string
export type EthUnidirectionalTransferAppInitialState<T = string> = {
  finalized: false;
  transfers: [Transfer<T>, Transfer<T>];
};
export type EthUnidirectionalTransferAppInitialStateBigNumber = EthUnidirectionalTransferAppInitialState<
  BigNumber
>;

export const SupportedApplications = {
  EthUnidirectionalTransferApp: "EthUnidirectionalTransferApp",
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
////// LOW LEVEL CHANNEL TYPES

// transfer types
export type Transfer<T = string> = {
  amount: T;
  to: Address; // NOTE: must be the xpub!!!
};
export type TransferBigNumber = Transfer<BigNumber>;

// asset types
export interface AssetAmount<T = string> {
  amount: T;
  assetId: Address; // empty address if eth
}
export type AssetAmountBigNumber = AssetAmount<BigNumber>;

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

// all the types of counterfactual app states
export type AppState<T = string> = EthUnidirectionalTransferAppState<T>;
export type AppStateBigNumber = AppState<BigNumber>;

// all the types of counterfactual app actions
export type AppAction<T = string> = EthUnidirectionalTransferAppAction<T>;
export type AppActionBigNumber = AppAction<BigNumber>;

////// ETHUnidirectionalTransferApp.sol typings
// @rahul --> does this need to be an interface or are types fine?
export type EthUnidirectionalTransferAppState<T = string> = {
  transfers: [Transfer<T>, Transfer<T>];
  finalized: boolean;
};
export type EthUnidirectionalTransferAppStateBigNumber = EthUnidirectionalTransferAppState<
  BigNumber
>;

export type EthUnidirectionalTransferAppAction<T = string> = {
  transferAmount: T;
  finalize: boolean;
};
export type EthUnidirectionalTransferAppActionBigNumber = EthUnidirectionalTransferAppAction<
  BigNumber
>;

export type User<T = string> = {
  id: number;
  xpub: string;
  channels: NodeChannel[];
};
export type UserBigNumber = User<BigNumber>;

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
export interface ChannelProvider {}

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
  contractAddresses: NetworkContext;
  nodePublicIdentifier: string;
  clusterId?: string;
  servers: string[];
  token?: string;
};

export type GetChannelResponse = NodeChannel;

export type CreateChannelResponse = NodeChannel;

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

////// Exchange types
// TODO: would we ever want to pay people in the same app with multiple currencies?
export interface ExchangeParameters<T = string> {
  amount: T;
  toAssetId: Address;
  fromAssetId: Address; // TODO: do these assets have to be renamed?
  // make sure they are consistent with CF stuffs
}
export type ExchangeParametersBigNumber = ExchangeParameters<BigNumber>;

////// Withdraw types
export type WithdrawParameters<T = string> = DepositParameters<T> & {
  recipient?: Address; // if not provided, will default to signer addr
};
export type WithdrawParametersBigNumber = WithdrawParameters<BigNumber>;

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
export function convertAssetAmount<To extends NumericTypeName>(
  to: To,
  obj: AssetAmount<any>,
): AssetAmount<NumericTypes[To]>;
export function convertAssetAmount<To extends NumericTypeName>(
  to: To,
  obj: Transfer<any>,
): Transfer<NumericTypes[To]>;
export function convertAssetAmount<To extends NumericTypeName>(
  to: To,
  obj: AssetAmount<any> | Transfer<any>,
): any {
  const fromType = getType(obj.amount);
  return convertFields(fromType, to, ["amount"], obj);
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
  return {
    ...asset,
    ...convertAssetAmount(to, asset),
  };
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
  return convertAssetAmount(to, asset);
}

export function convertAppState<To extends NumericTypeName>(
  to: To,
  obj: AppState<any>,
): AppState<NumericTypes[To]> {
  return {
    ...obj,
    transfers: [convertAssetAmount(to, obj.transfers[0]), convertAssetAmount(to, obj.transfers[1])],
  };
}

// DEFINE CONVERSION OBJECT TO BE EXPORTED
export const convert: any = {
  AppState: convertAppState,
  Asset: convertAssetAmount,
  Deposit: convertDepositParametersToAsset,
  Multisig: convertMultisig,
  Transfer: convertAssetAmount,
  TransferParameters: convertTransferParametersToAsset,
  Withdraw: convertWithdrawParametersToAsset,
};
