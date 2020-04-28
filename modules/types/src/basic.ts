import { BigNumber as ethersBN, BigNumberish, Interface, ParamType } from "ethers/utils";

export { Contract } from "ethers";
export { JsonRpcProvider, TransactionReceipt, TransactionResponse } from "ethers/providers";
export { BigNumberish, Network, Transaction } from "ethers/utils";

// special strings
// these function more as documentation for devs than checked types
export type ABIEncoding = string; // eg "tuple(address to, uint256 amount)"
export type Address = string; // aka HexString of length 42
export type AssetId = string; // aka Address of ERC20 token contract or AddressZero for ETH
export type Bytes32 = string; // aka HexString of length 66
export type DecString = string; // eg "3.14"
export type HexString = string; // eg "0xabc123" of arbitrary length
export type PublicIdentifier = string; // "indra" + base58(<publicKey>)
export type PublicKey = string; // aka HexString of length 132
export type PrivateKey = string; // aka Bytes32
export type SignatureString = string; // aka HexString of length 132
export type UrlString = string; // eg "<protocol>://<host>[:<port>]/<path>

export type BigNumber = ethersBN;
export const BigNumber = ethersBN;

// result of JSON.stringify(toBN(1))
// bigNumberifyJson & deBigNumberifyJson convert values between BigNumber & BigNumberJson
export type BigNumberJson = { _hex: HexString };

export type StringMapping = { [key: string]: string };

export interface EthSignature {
  r: string;
  s: string;
  v: string;
}

// This is copied from the ethers definition of how an ABI is typed.
export type ContractABI = Array<string | ParamType> | string | Interface;

export type SolidityPrimitiveType = string | BigNumberish | boolean;

type SolidityABIEncoderV2Struct = {
  [x: string]: SolidityValueType;
};

// TODO: fix circular type def
// @ts-ignore
type SolidityABIEncoderV2SArray = Array<SolidityValueType>;

// The application-specific state of an app instance, to be interpreted by the
// app developer. We just treat it as an opaque blob; however since we pass this
// around in protocol messages and include this in transaction data in challenges,
// we impose some restrictions on the type; they must be serializable both as
// JSON and as solidity structs.

// TODO: fix circular type def
// @ts-ignore
export type SolidityValueType =
  | SolidityPrimitiveType
  | SolidityABIEncoderV2Struct
  | SolidityABIEncoderV2SArray;

export type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;
