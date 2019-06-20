import { Node } from "@counterfactual/node";
import { Address, Node as NodeTypes } from "@counterfactual/types";
import { constants, utils } from "ethers";
import { Client as NatsClient } from "ts-nats";

import { NodeApiClient } from "./node";
import { Wallet } from "./wallet";

export type BigNumber = utils.BigNumber;
export const BigNumber = utils.BigNumber;

// types for the connext client package

// shared with node

/**
 * Type for instantiating the client. To properly instantiate the client, you
 * will need to provide one of the following:
 * - mnemonic
 * - privateKey
 * - externalWallet
 */
export interface ClientOptions {
  // provider, passed through to CF node
  rpcProviderUrl?: string; // TODO: can we keep out web3

  // node information
  nodeUrl: string; // http URL, https?://

  // nats information
  natsUrl: string; // nats URL, nats://

  // signing options, include at least one of the following
  mnemonic?: string;
  privateKey?: string;
  // if using an external wallet, include this option
  externalWallet?: any; // TODO: better typing here?

  // channel provider
  channelProvider?: ChannelProvider;

  // function passed in by wallets to generate ephemeral keys
  // used when signing applications
  keyGen?: () => Promise<string>; // TODO: what will the type look like?
  safeSignHook?: (state: ChannelState | AppState) => Promise<string>;
  // TODO: Do we need these if we use the whole store?
  loadState?: (key: string) => Promise<string | null>;
  saveState?: (
    pairs: {
      key: string;
      value: any;
    }[],
  ) => Promise<void>;
  store: any;
  // TODO: state: string?
  logLevel?: number; // see logger.ts for meaning, optional

  // TODO: should be used in internal options? --> only if hardcoded
  // nats communication config, client must provide
  natsClusterId?: string;
  natsToken?: string;
}

export type InternalClientOptions = ClientOptions & {
  // Optional, useful for dependency injection
  // TODO: can nats, node, wallet be optional?
  nats: NatsClient; // converted to nats-client in ConnextInternal constructor
  node: NodeApiClient;
  // signing wallet/information
  wallet: Wallet;
  // store: ConnextStore; --> whats this look like
  contract?: MultisigState;
  // counterfactual node
  cfModule: Node;
  multisigAddress: string;
};

// TODO: define properly!!
export interface ChannelProvider {}

export interface ChannelState<T = string> {
  apps: AppState<T>[];
  // TODO: CF types should all be generic, this will be
  // a BigNumber
  freeBalance: NodeTypes.GetFreeBalanceStateResult;
}
export type ChannelStateBigNumber = ChannelState<BigNumber>;

export interface ConnextStore {}
export type MultisigState<T = string> = {
  id: number;
  xpubA: string;
  xpubB: string;
  multisigAddress: string;
  freeBalanceA: T;
  freeBalanceB: T;
  appIds: number[]; // appIds
};
export type MultisigStateBigNumber = MultisigState<BigNumber>;

///////////////////////////////////
////////// NODE TYPES ////////////
/////////////////////////////////

////// General typings
export interface NodeInitializationParameters {
  nodeUrl: string;
  nats: NatsClient;
  wallet: Wallet;
  logLevel?: number;
}

///// Specific response types
export interface NodeConfig {
  nodePublicIdentifier: string; // x-pub of node
  chainId: string; // network that your channel is on
  nodeUrl: string;
}

// TODO: move to the types package IFF hub needs these
/////////////////////////////////
////////// APP TYPES ////////////
/////////////////////////////////

// all the types of counterfactual app states
export type AppState<T = string> = EthUnidirectionalTransferAppState<T>;
export type AppStateBigNumber = AppState<BigNumber>;

// all the types of counterfactual app actions
export type AppAction<T = string> = EthUnidirectionalTransferAppAction<T>;
export type AppActionBigNumber = AppAction<BigNumber>;

////// ETHUnidirectionalTransferApp.sol typings
export interface EthUnidirectionalTransferAppState<T = string> {
  transfers: [Transfer<T>, Transfer<T>];
  finalized: boolean;
}
export type EthUnidirectionalTransferAppStateBigNumber = EthUnidirectionalTransferAppState<
  BigNumber
>;

export interface EthUnidirectionalTransferAppAction<T = string> {
  transferAmount: T;
  finalize: boolean;
}
export type EthUnidirectionalTransferAppActionBigNumber = EthUnidirectionalTransferAppAction<
  BigNumber
>;

// TODO: move to the types package IFF hub needs these
/////////////////////////////////
///////// INPUT TYPES ///////////
/////////////////////////////////

////// Deposit types
// TODO: we should have a way to deposit multiple things
export type DepositParameters<T = string> = Omit<AssetAmount<T>, "assetId"> & {
  assetId?: Address; // if not supplied, assume it is eth
};
export type DepositParametersBigNumber = DepositParameters<BigNumber>;

////// Transfer types
// TODO: would we ever want to pay people in the same app with multiple currencies?
export type TransferParameters<T = string> = AssetAmount<T> & {
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
export type WithdrawParameters<T = string> = AssetAmount<T> & {
  recipient?: Address; // if not provided, will default to signer addr
};
export type WithdrawParametersBigNumber = WithdrawParameters<BigNumber>;

// TODO: move to the types package (?)
/////////////////////////////////
/////// LOW LEVEL TYPES /////////
/////////////////////////////////
// transfer types
export type Transfer<T = string> = AssetAmount<T> & {
  to: Address;
};
export type TransferBigNumber = Transfer<BigNumber>;

// asset types
export interface AssetAmount<T = string> {
  amount: T;
  assetId: Address; // empty address if eth
}
export type AssetAmountBigNumber = AssetAmount<BigNumber>;

// TODO: move all conversion functions to the types
// package
/////////////////////////////////
//////// CONVERSION FNS /////////
/////////////////////////////////

export type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;

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
  throw new Error(
    `Unknown input type: ${typeof input}, value: ${JSON.stringify(input)}`,
  );
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

// INPUT PARAMETER CONVERSIONS
/**
 * Conversion function for DepositParameter to an AssetAmount. Will also add
 * in the proper assetId if it is left blank in the supplied parameters to the
 * empty eth address
 */
export function convertDepositToAsset<To extends NumericTypeName>(
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

// DEFINE CONVERSION OBJECT TO BE EXPORTED
export const convert: any = {
  Asset: convertAssetAmount,
  Transfer: convertAssetAmount,
};
