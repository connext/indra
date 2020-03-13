import { ABIEncoding, Address, DecString, HexString, SolidityValueType, Xpub } from "./basic";
import {
  MultiAssetMultiPartyCoinTransferInterpreterParams,
  OutcomeType,
  SingleAssetTwoPartyCoinTransferInterpreterParams,
  TwoPartyFixedOutcomeInterpreterParams,
} from "./contracts";

////////////////////////////////////
// App Instances

export enum PersistAppType {
  Proposal = "proposal",
  Instance = "instance", // install / update
  Reject = "reject",
  Uninstall = "uninstall",
}

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
  initiatorDeposit: DecString;
  initiatorDepositTokenAddress: Address;
  responderDeposit: DecString;
  responderDepositTokenAddress: Address;
  timeout: HexString;
  proposedByIdentifier: Xpub;
  proposedToIdentifier: Xpub;
  intermediaryIdentifier?: Xpub;
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
  outcomeType: number;
  // Interpreter Params
  twoPartyOutcomeInterpreterParams?:
    TwoPartyFixedOutcomeInterpreterParams
  multiAssetMultiPartyCoinTransferInterpreterParams?:
    MultiAssetMultiPartyCoinTransferInterpreterParams
  singleAssetTwoPartyCoinTransferInterpreterParams?:
    SingleAssetTwoPartyCoinTransferInterpreterParams
};

export type AppInstanceProposal = {
  abiEncodings: AppABIEncodings;
  appDefinition: Address;
  appSeqNo: number;
  identityHash: HexString;
  initialState: SolidityValueType;
  initiatorDeposit: DecString;
  initiatorDepositTokenAddress: Address;
  intermediaryIdentifier?: Xpub;
  outcomeType: OutcomeType;
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
