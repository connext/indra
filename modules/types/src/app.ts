import {
  ABIEncoding,
  Address,
  AssetId,
  DecString,
  HexString,
  PublicIdentifier,
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

export type AppABIEncodings = {
  stateEncoding: ABIEncoding;
  actionEncoding: ABIEncoding | undefined;
};

export type AppInstanceJson = {
  identityHash: HexString;
  multisigAddress: Address;
  initiatorIdentifier: PublicIdentifier;
  responderIdentifier: PublicIdentifier;
  defaultTimeout: HexString;
  appInterface: AppInterface;
  appSeqNo: number;
  latestState: SolidityValueType;
  latestVersionNumber: number;
  stateTimeout: HexString;
  outcomeType: string;
  meta?: object;
  latestAction?: SolidityValueType;
  // Interpreter Params
  twoPartyOutcomeInterpreterParams?: TwoPartyFixedOutcomeInterpreterParamsJson;
  multiAssetMultiPartyCoinTransferInterpreterParams?:
    MultiAssetMultiPartyCoinTransferInterpreterParamsJson;
  singleAssetTwoPartyCoinTransferInterpreterParams?:
    SingleAssetTwoPartyCoinTransferInterpreterParamsJson;
};

export type AppInstanceProposal = {
  abiEncodings: AppABIEncodings;
  appDefinition: Address;
  appSeqNo: number;
  identityHash: HexString;
  initialState: SolidityValueType;
  initiatorDeposit: DecString;
  initiatorDepositAssetId: AssetId;
  outcomeType: OutcomeType;
  initiatorIdentifier: PublicIdentifier;
  responderIdentifier: PublicIdentifier;
  responderDeposit: DecString;
  responderDepositAssetId: AssetId;
  defaultTimeout: HexString;
  stateTimeout: HexString;
  meta?: object;
  // Interpreter Params
  twoPartyOutcomeInterpreterParams?: TwoPartyFixedOutcomeInterpreterParams;
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
