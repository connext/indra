import { ABIEncoding, Address, BigNumber, HexString, SolidityValueType, Xpub } from "./basic";
import {
  MultiAssetMultiPartyCoinTransferInterpreterParams,
  OutcomeType,
  SingleAssetTwoPartyCoinTransferInterpreterParams,
  TwoPartyFixedOutcomeInterpreterParams,
} from "./contracts";

////////////////////////////////////
////// App Instances

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
  initiatorDeposit: BigNumber;
  initiatorDepositTokenAddress: Address;
  responderDeposit: BigNumber;
  responderDepositTokenAddress: Address;
  timeout: BigNumber;
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
  participants: string[];
  defaultTimeout: number;
  appInterface: AppInterface;
  isVirtualApp: boolean;
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
  appDefinition: string;
  appSeqNo: number;
  identityHash: string;
  initialState: SolidityValueType;
  initiatorDeposit: string;
  initiatorDepositTokenAddress: string;
  intermediaryIdentifier?: string;
  outcomeType: OutcomeType;
  proposedByIdentifier: Xpub;
  proposedToIdentifier: Xpub;
  responderDeposit: string;
  responderDepositTokenAddress: Address;
  timeout: string;
  // Interpreter Params
  twoPartyOutcomeInterpreterParams?:
    TwoPartyFixedOutcomeInterpreterParams;
  multiAssetMultiPartyCoinTransferInterpreterParams?:
    MultiAssetMultiPartyCoinTransferInterpreterParams;
  singleAssetTwoPartyCoinTransferInterpreterParams?:
    SingleAssetTwoPartyCoinTransferInterpreterParams;
};

////////////////////////////////////
////// App Registry

export type DefaultApp = {
  actionEncoding?: ABIEncoding;
  allowNodeInstall: boolean;
  appDefinitionAddress: Address;
  name: string;
  chainId: number;
  outcomeType: OutcomeType;
  stateEncoding: string;
};

export type AppRegistry = DefaultApp[];
