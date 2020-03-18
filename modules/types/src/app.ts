<<<<<<< HEAD
import { ABIEncoding, Address, DecString, HexString, SolidityValueType, Xpub } from "./basic";
=======
import { Address, BigNumber, BigNumberish, SolidityValueType } from "./basic";
>>>>>>> 845-store-refactor
import {
  MultiAssetMultiPartyCoinTransferInterpreterParams,
  OutcomeType,
  SingleAssetTwoPartyCoinTransferInterpreterParams,
  TwoPartyFixedOutcomeInterpreterParams,
} from "./contracts";
<<<<<<< HEAD
import { enumify } from "./utils";
=======
>>>>>>> 845-store-refactor

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
<<<<<<< HEAD
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
=======
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
>>>>>>> 845-store-refactor
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
<<<<<<< HEAD
  initiatorDeposit: DecString;
  initiatorDepositTokenAddress: Address;
  intermediaryIdentifier?: Xpub;
=======
  initiatorDeposit: string;
  initiatorDepositTokenAddress: string;
>>>>>>> 845-store-refactor
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
