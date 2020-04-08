import {
  ABIEncoding,
  Address,
  DecString,
  HexString,
  SolidityValueType,
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

export type SignedAppChallengeUpdate = {
  appStateHash: HexString;
  versionNumber: number;
  timeout: number;
  signatures: string[];
};

export type AppABIEncodings = {
  stateEncoding: ABIEncoding;
  actionEncoding: ABIEncoding | undefined;
};

export type AppInstanceJson = {
  identityHash: HexString;
  multisigAddress: Address;
  initiator: Address;
  responder: Address;
  defaultTimeout: HexString;
  appInterface: AppInterface;
  appSeqNo: number;
  latestState: SolidityValueType;
  latestVersionNumber: number;
  stateTimeout: HexString;
  outcomeType: string;
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
  initiator: Address;
  responder: Address;
  responderDeposit: DecString;
  responderDepositTokenAddress: Address;
  defaultTimeout: HexString;
  stateTimeout: HexString;
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
