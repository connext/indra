import { Address, JsonRpcProvider } from "../basic";
import { enumify, tidy } from "../utils";

////////////////////////////////////////
// Generic contract ops & network config

export type AddressBook = {
  [chainId: string]: {
    [contractName: string]: {
      address: Address;
      txHash?: string;
      creationCodeHash?: string;
      runtimeCodeHash?: string;
    };
  };
};

export type AddressHistory = {
  [chainId: string]: {
    [contractName: string]: Address[];
  };
};

export type ContractAddresses = NetworkContext & {
  Token: Address;
  [SupportedApplication: string]: Address;
};

export interface NetworkContext {
  ChallengeRegistry: Address;
  ConditionalTransactionDelegateTarget: Address;
  IdentityApp: Address;
  MinimumViableMultisig: Address;
  MultiAssetMultiPartyCoinTransferInterpreter: Address;
  ProxyFactory: Address;
  SingleAssetTwoPartyCoinTransferInterpreter: Address;
  TimeLockedPassThrough: Address;
  TwoPartyFixedOutcomeInterpreter: Address;
  provider: JsonRpcProvider;
}

// Keep in sync with above
export const EXPECTED_CONTRACT_NAMES_IN_NETWORK_CONTEXT = [
  "ChallengeRegistry",
  "ConditionalTransactionDelegateTarget",
  "IdentityApp",
  "MinimumViableMultisig",
  "MultiAssetMultiPartyCoinTransferInterpreter",
  "ProxyFactory",
  "SingleAssetTwoPartyCoinTransferInterpreter",
  "TimeLockedPassThrough",
  "TwoPartyFixedOutcomeInterpreter",
];

//////////////////////////////////////// 
// Mixins, etc

export const singleAssetTwoPartyCoinTransferEncoding = tidy(`tuple(
  address to,
  uint256 amount
)[2]`);

export const multiAssetMultiPartyCoinTransferEncoding = tidy(`tuple(
  address to,
  uint256 amount
)[][]`);

export const OutcomeType = enumify({
  // uint8
  TWO_PARTY_FIXED_OUTCOME: "TWO_PARTY_FIXED_OUTCOME",
  // CoinTransfer[][]
  MULTI_ASSET_MULTI_PARTY_COIN_TRANSFER: "MULTI_ASSET_MULTI_PARTY_COIN_TRANSFER",
  // CoinTransfer[2]
  SINGLE_ASSET_TWO_PARTY_COIN_TRANSFER: "SINGLE_ASSET_TWO_PARTY_COIN_TRANSFER",
});
export type OutcomeType = (typeof OutcomeType)[keyof typeof OutcomeType];

// Commitment targets
export const CommitmentTarget = enumify({
  MULTISIG: "0",
  SET_STATE: "1",
  CANCEL_DISPUTE: "2",
});

