import {
  Web3Provider
} from "ethers/providers";

import { BigNumber } from "ethers/utils";
import { Address } from "@counterfactual/types";

// types for the connext client package

// shared with node

export interface ClientOptions {
  mnemonic?: string;
  privateKey?: string;
  web3Provider?: Web3Provider; // TODO: JsonRpcProvider ?
  channelProvider?: ChannelProvider;
  safeSignHook?: (state: ChannelState | AppState) => Promise<string>;
  loadState?: () => Promise<string | null>;
  saveState?: (state: ChannelState | AppState) => Promise<any>; // TODO: state: string?
  nodeUrl: string;
  // Optional, useful for dependency injection
  node?: INodeAPIClient;
  store?: ConnextStore;
  contract?: IMultisig; // TODO: rename? replacing IChannelManager
}

// TODO: define properly!!
export type ChannelProvider = {}
export type ChannelState = {}
export type INodeAPIClient = {}
export type ConnextStore = {}
export type IMultisig = {}

///////////////////////////////////
////////// NODE TYPES ////////////
/////////////////////////////////

export type NodeConfig = {
  channelAddress: Address // address of channel multisig
  chainId: string // network that your channel is on
  nodeSigningKey: Address // signer address of the node
  nodeUrl: string
}

/////////////////////////////////
////////// APP TYPES ////////////
/////////////////////////////////

// all the types of counterfactual app states
export type AppState<T=string> = EthUnidirectionalTransferAppState<T>
export type AppStateBigNumber = AppState<BigNumber>

// all the types of counterfactual app actions
export type AppAction<T=string> = EthUnidirectionalTransferAppAction<T>
export type AppActionBigNumber = AppAction<BigNumber>

////// ETHUnidirectionalTransferApp.sol typings
export type EthUnidirectionalTransferAppState<T=string> = {
  transfers: [Transfer<T>, Transfer<T>];
  finalized: boolean;
}
export type EthUnidirectionalTransferAppStateBigNumber = EthUnidirectionalTransferAppState<BigNumber>

export type EthUnidirectionalTransferAppAction<T=string> = {
  transferAmount: T;
  finalize: boolean;
}
export type EthUnidirectionalTransferAppActionBigNumber = EthUnidirectionalTransferAppAction<BigNumber>


/////////////////////////////////
///////// INPUT TYPES ///////////
/////////////////////////////////

// TODO: we should have a way to deposit multiple things
export type DepositParameters<T = string> = AssetAmount<T>
export type DepositParametersBigNumber = DepositParameters<BigNumber>


/////////////////////////////////
/////// LOW LEVEL TYPES /////////
/////////////////////////////////
// transfer types
export type Transfer<T=string> = AssetAmount<T> & {
  to: Address;
}
export type TransferBigNumber = Transfer<BigNumber>

// asset types
export type AssetAmount<T=string> = {
  amount: T;
  assetId?: Address; // undefined if eth
}
export type AssetAmountBigNumber = AssetAmount<BigNumber>


/////////////////////////////////
//////// CONVERSION FNS /////////
/////////////////////////////////
export type NumericTypes = {
  'str': string;
  'bignumber': BigNumber;
  'number': number;
}

export type NumericTypeName = keyof NumericTypes;

const getType = (input: any): NumericTypeName => {
  if (typeof input === 'string') return 'str'
  if (BigNumber.isBigNumber(input)) return 'bignumber'
  if (typeof input === 'number') return 'number' // used for testing purposes
  throw new Error(`Unknown input type: ${typeof input}, value: ${JSON.stringify(input)}`)
}

const castFunctions: any = {
  'bignumber-str': (x: BigNumber): string => x.toString(),
  'number-bignumber': (x: number): BigNumber => new BigNumber(x),
  'number-str': (x: number): string => x.toString(),
  'str-bignumber': (x: string): BigNumber => new BigNumber(x),
}

export const convertFields = (
  fromType: NumericTypeName, toType: NumericTypeName, fields: string[], input: any,
): any => {
  if (fromType === toType) return input

  if (toType === 'number') throw new Error('Should not convert fields to numbers')

  let key
  if (fromType === 'number' && toType === 'str') {
    key = `bignumber-str`
  } else if (fromType === 'number') {
    key = `str-${toType}`
  }

  // casting functions same for strs and number types
  const cast = castFunctions[key || [fromType, toType].join('-')]
  if (!cast) throw new Error(`No castFunc for ${fromType} -> ${toType}`)

  const res = { ...input }
  for (const field of fields) {
    const name = field.split('?')[0]
    const isOptional = field.endsWith('?')
    if (isOptional && !(name in input)) continue
    res[name] = cast(input[name])
  }

  return res
}

/**
 * Conversion function for AssetAmount or Transfer types. More generally, will
 * work for any types with only the numeric field "amount" with properly added
 * overloading definitions 
 */
export function convertAssetAmount <
To extends NumericTypeName,
>(
  to: To, obj: AssetAmount<any>,
): AssetAmount<NumericTypes[To]>;
export function convertAssetAmount <
To extends NumericTypeName,
>(
  to: To, obj: Transfer<any>,
): Transfer<NumericTypes[To]>;
export function convertAssetAmount <
  To extends NumericTypeName,
>(
  to: To, obj: AssetAmount<any> | Transfer<any>,
) {
  const fromType = getType(obj.amount)
  return convertFields(fromType, to, ["amount"], obj)
}

export const convert: any = {
  Asset: convertAssetAmount,
  Transfer: convertAssetAmount,
}