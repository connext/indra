import { BaseProvider, BigNumber } from "./basic";

////////////////////////////////////////
// Generic contract ops & network config

export interface NetworkContext {
  ChallengeRegistry: string;
  CoinBalanceRefundApp: string;
  ConditionalTransactionDelegateTarget: string;
  IdentityApp: string;
  MinimumViableMultisig: string;
  MultiAssetMultiPartyCoinTransferInterpreter: string;
  ProxyFactory: string;
  SingleAssetTwoPartyCoinTransferInterpreter: string;
  TimeLockedPassThrough: string;
  TwoPartyFixedOutcomeFromVirtualAppInterpreter: string;
  TwoPartyFixedOutcomeInterpreter: string;
  provider?: BaseProvider;
}

// Keep in sync with above
export const EXPECTED_CONTRACT_NAMES_IN_NETWORK_CONTEXT = [
  "ChallengeRegistry",
  "ConditionalTransactionDelegateTarget",
  "CoinBalanceRefundApp",
  "MultiAssetMultiPartyCoinTransferInterpreter",
  "IdentityApp",
  "MinimumViableMultisig",
  "ProxyFactory",
  "SingleAssetTwoPartyCoinTransferInterpreter",
  "TimeLockedPassThrough",
  "TwoPartyFixedOutcomeInterpreter",
  "TwoPartyFixedOutcomeFromVirtualAppInterpreter",
];

export interface DeployedContractNetworksFileEntry {
  contractName: string;
  address: string;
  transactionHash: string;
}

////////////////////////////////////////
// Specific contract Interfaces

export type SingleAssetTwoPartyIntermediaryAgreement = {
  timeLockedPassThroughIdentityHash: string;
  capitalProvided: string;
  capitalProvider: string;
  virtualAppUser: string;
  tokenAddress: string;
};

// Derived from:
// cf-funding-protocol/contracts/interpreters/TwoPartyFixedOutcomeInterpreter.sol#L10
export type TwoPartyFixedOutcomeInterpreterParams = {
  playerAddrs: [string, string];
  amount: BigNumber;
  tokenAddress: string;
};

// Derived from:
// cf-funding-protocol/contracts/interpreters/MultiAssetMultiPartyCoinTransferInterpreter.sol#L18
export type MultiAssetMultiPartyCoinTransferInterpreterParams = {
  limit: BigNumber[];
  tokenAddresses: string[];
};

export type SingleAssetTwoPartyCoinTransferInterpreterParams = {
  limit: BigNumber;
  tokenAddress: string;
};

export const multiAssetMultiPartyCoinTransferInterpreterParamsEncoding =
  "tuple(uint256[] limit, address[] tokenAddresses)";

export const singleAssetTwoPartyCoinTransferInterpreterParamsEncoding =
  "tuple(uint256 limit, address tokenAddress)";

export const twoPartyFixedOutcomeInterpreterParamsEncoding =
  "tuple(address[2] playerAddrs, uint256 amount)";

export const virtualAppAgreementEncoding =
  "tuple(uint256 capitalProvided, address capitalProvider, address virtualAppUser, address tokenAddress)";

export const multiAssetMultiPartyCoinTransferEncoding = "tuple(address to, uint256 amount)[][]";

export const coinBalanceRefundStateEncoding =
  "tuple(address recipient, address multisig, uint256 threshold, address tokenAddress)";

export enum OutcomeType {
  // uint8
  TWO_PARTY_FIXED_OUTCOME = "TWO_PARTY_FIXED_OUTCOME",
  // CoinTransfer[][]
  MULTI_ASSET_MULTI_PARTY_COIN_TRANSFER = "MULTI_ASSET_MULTI_PARTY_COIN_TRANSFER",
  // CoinTransfer[2]
  SINGLE_ASSET_TWO_PARTY_COIN_TRANSFER = "SINGLE_ASSET_TWO_PARTY_COIN_TRANSFER",
}

// TwoPartyFixedOutcome.sol::Outcome
export enum TwoPartyFixedOutcome {
  SEND_TO_ADDR_ONE = 0,
  SEND_TO_ADDR_TWO = 1,
  SPLIT_AND_SEND_TO_BOTH_ADDRS = 2,
}

export type CoinBalanceRefundState = {
  recipient: string;
  multisig: string;
  threshold: BigNumber;
  tokenAddress: string;
};
