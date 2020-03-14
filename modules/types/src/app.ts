import { Address, BigNumber, BigNumberish, SolidityValueType } from "./basic";
import {
  MultiAssetMultiPartyCoinTransferInterpreterParams,
  OutcomeType,
  SingleAssetTwoPartyCoinTransferInterpreterParams,
  TwoPartyFixedOutcomeInterpreterParams,
} from "./contracts";

////////////////////////////////////
////// App Instances

export type AppIdentity = {
  channelNonce: BigNumberish;
  participants: string[];
  appDefinition: string;
  defaultTimeout: number;
};

export type AppInterface = {
  addr: string;
  stateEncoding: string;
  actionEncoding: string | undefined;
};

export type SignedStateHashUpdate = {
  appStateHash: string;
  versionNumber: number;
  timeout: number;
  signatures: string[];
};

export type AppABIEncodings = {
  stateEncoding: string;
  actionEncoding: string | undefined;
};

export type AppInstanceInfo = {
  identityHash: string;
  appDefinition: string;
  abiEncodings: AppABIEncodings;
  initiatorDeposit: BigNumber;
  initiatorDepositTokenAddress: string;
  responderDeposit: BigNumber;
  responderDepositTokenAddress: string;
  timeout: BigNumber;
  proposedByIdentifier: string; // xpub
  proposedToIdentifier: string; // xpub
  // Interpreter-related Fields:
  twoPartyOutcomeInterpreterParams?: TwoPartyFixedOutcomeInterpreterParams;
  multiAssetMultiPartyCoinTransferInterpreterParams?: MultiAssetMultiPartyCoinTransferInterpreterParams;
  singleAssetTwoPartyCoinTransferInterpreterParams?: SingleAssetTwoPartyCoinTransferInterpreterParams;
};

export type AppInstanceJson = {
  identityHash: string;
  multisigAddress: string;
  participants: string[];
  defaultTimeout: number;
  appInterface: AppInterface;
  appSeqNo: number;
  latestState: SolidityValueType;
  latestVersionNumber: number;
  latestTimeout: number;
  outcomeType: number;
  // Derived from:
  // contracts/funding/interpreters/TwoPartyFixedOutcomeInterpreter.sol#L10
  twoPartyOutcomeInterpreterParams?: {
    playerAddrs: [string, string];
    amount: { _hex: string };
    tokenAddress: string;
  };
  // Derived from:
  // contracts/funding/interpreters/MultiAssetMultiPartyCoinTransferInterpreter.sol#L18
  multiAssetMultiPartyCoinTransferInterpreterParams?: {
    limit: { _hex: string }[];
    tokenAddresses: string[];
  };
  singleAssetTwoPartyCoinTransferInterpreterParams?: {
    limit: { _hex: string };
    tokenAddress: string;
  };
};

export type AppInstanceProposal = {
  abiEncodings: AppABIEncodings;
  appDefinition: string;
  appSeqNo: number;
  identityHash: string;
  initialState: SolidityValueType;
  initiatorDeposit: string;
  initiatorDepositTokenAddress: string;
  outcomeType: OutcomeType;
  proposedByIdentifier: string;
  proposedToIdentifier: string;
  responderDeposit: string;
  responderDepositTokenAddress: string;
  timeout: string;
  // Interpreter-related Fields
  twoPartyOutcomeInterpreterParams?: TwoPartyFixedOutcomeInterpreterParams;
  multiAssetMultiPartyCoinTransferInterpreterParams?: MultiAssetMultiPartyCoinTransferInterpreterParams;
  singleAssetTwoPartyCoinTransferInterpreterParams?: SingleAssetTwoPartyCoinTransferInterpreterParams;
};

////////////////////////////////////
////// App Registry
export type DefaultApp = {
  actionEncoding?: string;
  allowNodeInstall: boolean;
  appDefinitionAddress: string;
  name: string;
  chainId: number;
  outcomeType: OutcomeType;
  stateEncoding: string;
};

export type AppRegistry = DefaultApp[];

////////////////////////////////////
// Generic Apps

export type CoinTransfer<T = string> = {
  amount: T;
  to: Address; // NOTE: must be the xpub!!!
};
export type CoinTransferBigNumber = CoinTransfer<BigNumber>;
