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

// Contract addresses that must be provided to withdraw funds from a channel
// Losing track of a critical address means losing access to the funds in that channel
// Each channel must track it's own critical addresses because there's no
//   guarantee that these addresses will be the same across different channels
export type CriticalStateChannelAddresses = {
  ProxyFactory: Address;
  MinimumViableMultisig: Address;
};

export type ContractAddresses = CriticalStateChannelAddresses & {
  ChallengeRegistry: Address;
  ConditionalTransactionDelegateTarget: Address;
  DepositApp: Address;
  HashLockTransferApp?: Address;
  IdentityApp: Address;
  MultiAssetMultiPartyCoinTransferInterpreter: Address;
  SimpleLinkedTransferApp?: Address;
  SimpleSignedTransferApp?: Address;
  SimpleTwoPartySwapApp?: Address;
  SingleAssetTwoPartyCoinTransferInterpreter: Address;
  TimeLockedPassThrough: Address;
  Token?: Address;
  TwoPartyFixedOutcomeInterpreter: Address;
};

export interface NetworkContext {
  contractAddresses: ContractAddresses;
  provider: JsonRpcProvider;
}

// Keep in sync with required addresses of ContractAddresses
export const EXPECTED_CONTRACT_NAMES_IN_NETWORK_CONTEXT = [
  "ChallengeRegistry",
  "ConditionalTransactionDelegateTarget",
  "DepositApp",
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

