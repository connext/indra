import {
  ABIEncoding,
  Address,
  BigNumber,
  DecString,
  HexString,
  SolidityValueType,
  Xpub,
} from "./basic";
import {
  MultiAssetMultiPartyCoinTransferInterpreterParams,
  OutcomeType,
  SingleAssetTwoPartyCoinTransferInterpreterParams,
  TwoPartyFixedOutcomeInterpreterParams,
} from "./contracts";
import { enumify } from "./utils";

////////////////////////////////////
// App Instances

export const PersistAppType = enumify({
  Proposal: "Proposal",
  Instance: "Instance", // install / update
  Reject: "Reject",
  Uninstall: "Uninstall",
});
export type PersistAppType = (typeof PersistAppType)[keyof typeof PersistAppType];

export type AppInterface = {
  addr: Address;
  stateEncoding: ABIEncoding;
  actionEncoding: ABIEncoding | undefined;
};

export type SignedStateHashUpdate = {
  appStateHash: HexString;
  versionNumber: number;
  timeout: number;
  signatures: string[];
};

export type AppABIEncodings = {
  stateEncoding: ABIEncoding;
  actionEncoding: ABIEncoding | undefined;
};

export type AppInstanceInfo = {
  identityHash: HexString;
  appDefinition: Address;
  abiEncodings: AppABIEncodings;
  initiatorDeposit: BigNumber;
  initiatorDepositTokenAddress: Address;
  responderDeposit: BigNumber;
  responderDepositTokenAddress: Address;
  timeout: BigNumber;
  proposedByIdentifier: Xpub;
  proposedToIdentifier: Xpub;
  // Interpreter Params
  twoPartyOutcomeInterpreterParams?:
    TwoPartyFixedOutcomeInterpreterParams;
  multiAssetMultiPartyCoinTransferInterpreterParams?:
    MultiAssetMultiPartyCoinTransferInterpreterParams;
  singleAssetTwoPartyCoinTransferInterpreterParams?:
    SingleAssetTwoPartyCoinTransferInterpreterParams;
};

export type AppInstanceJson = {
  identityHash: HexString;
  multisigAddress: Address;
  participants: Xpub[];
  defaultTimeout: number;
  appInterface: AppInterface;
  appSeqNo: number;
  latestState: SolidityValueType;
  latestVersionNumber: number;
  latestTimeout: number;
  outcomeType: string;
<<<<<<< HEAD
  // Interpreter Params
  twoPartyOutcomeInterpreterParams?:
    TwoPartyFixedOutcomeInterpreterParams
  multiAssetMultiPartyCoinTransferInterpreterParams?:
    MultiAssetMultiPartyCoinTransferInterpreterParams
  singleAssetTwoPartyCoinTransferInterpreterParams?:
    SingleAssetTwoPartyCoinTransferInterpreterParams
=======
  meta?: object;
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
>>>>>>> nats-messaging-refactor
};

export type AppInstanceProposal = {
  abiEncodings: AppABIEncodings;
  appDefinition: Address;
  appSeqNo: number;
  identityHash: HexString;
  initialState: SolidityValueType;
  initiatorDeposit: DecString;
  initiatorDepositTokenAddress: Address;
  outcomeType: OutcomeType;
<<<<<<< HEAD
  proposedByIdentifier: Xpub;
  proposedToIdentifier: Xpub;
  responderDeposit: DecString;
  responderDepositTokenAddress: Address;
  timeout: HexString;
  // Interpreter Params
  twoPartyOutcomeInterpreterParams?:
    TwoPartyFixedOutcomeInterpreterParams;
  multiAssetMultiPartyCoinTransferInterpreterParams?:
    MultiAssetMultiPartyCoinTransferInterpreterParams;
  singleAssetTwoPartyCoinTransferInterpreterParams?:
    SingleAssetTwoPartyCoinTransferInterpreterParams;
=======
  proposedByIdentifier: string;
  proposedToIdentifier: string;
  responderDeposit: string;
  responderDepositTokenAddress: string;
  timeout: string;
  meta?: object;
  // Interpreter-related Fields
  twoPartyOutcomeInterpreterParams?: TwoPartyFixedOutcomeInterpreterParams;
  multiAssetMultiPartyCoinTransferInterpreterParams?: MultiAssetMultiPartyCoinTransferInterpreterParams;
  singleAssetTwoPartyCoinTransferInterpreterParams?: SingleAssetTwoPartyCoinTransferInterpreterParams;
>>>>>>> nats-messaging-refactor
};

////////////////////////////////////
// App Registry

export type DefaultApp = {
  actionEncoding?: ABIEncoding;
  allowNodeInstall: boolean;
  appDefinitionAddress: Address;
  name: string;
  chainId: number;
  outcomeType: OutcomeType;
  stateEncoding: ABIEncoding;
};

export type AppRegistry = DefaultApp[];
