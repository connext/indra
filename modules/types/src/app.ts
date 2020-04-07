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
  MultiAssetMultiPartyCoinTransferInterpreterParamsJson,
  OutcomeType,
  SingleAssetTwoPartyCoinTransferInterpreterParams,
  SingleAssetTwoPartyCoinTransferInterpreterParamsJson,
  TwoPartyFixedOutcomeInterpreterParams,
  TwoPartyFixedOutcomeInterpreterParamsJson,
} from "./contracts";

////////////////////////////////////
// App Instances

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
  outcomeType: OutcomeType;
  meta?: object;
  // Interpreter Params
  twoPartyOutcomeInterpreterParams?:
    TwoPartyFixedOutcomeInterpreterParamsJson
  multiAssetMultiPartyCoinTransferInterpreterParams?:
    MultiAssetMultiPartyCoinTransferInterpreterParamsJson
  singleAssetTwoPartyCoinTransferInterpreterParams?:
    SingleAssetTwoPartyCoinTransferInterpreterParamsJson
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
  proposedByIdentifier: Xpub;
  proposedToIdentifier: Xpub;
  responderDeposit: DecString;
  responderDepositTokenAddress: Address;
  timeout: HexString;
  meta?: object;
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
