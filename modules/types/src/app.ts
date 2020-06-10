import { ABIEncoding, Address, AssetId, DecString, HexString, PublicIdentifier } from "./basic";
import {
  MultiAssetMultiPartyCoinTransferInterpreterParamsJson,
  OutcomeType,
  SingleAssetTwoPartyCoinTransferInterpreterParamsJson,
  TwoPartyFixedOutcomeInterpreterParamsJson,
} from "./contracts";

////////////////////////////////////
// App Instances

export type AppABIEncodings = {
  stateEncoding: ABIEncoding;
  actionEncoding: ABIEncoding | undefined;
};

export type AppInstanceJson = {
  multisigAddress: Address;
  identityHash: HexString;
  initiatorIdentifier: PublicIdentifier;
  responderIdentifier: PublicIdentifier;
  initiatorDeposit: DecString;
  initiatorDepositAssetId: AssetId;
  responderDeposit: DecString;
  responderDepositAssetId: AssetId;
  abiEncodings: AppABIEncodings;
  appDefinition: Address;
  appSeqNo: number;
  defaultTimeout: HexString;
  stateTimeout: HexString;
  latestState: any;
  latestVersionNumber: number;
  outcomeType: OutcomeType;
  meta?: any;
  latestAction?: any;
  outcomeInterpreterParameters:
    | TwoPartyFixedOutcomeInterpreterParamsJson
    | MultiAssetMultiPartyCoinTransferInterpreterParamsJson
    | SingleAssetTwoPartyCoinTransferInterpreterParamsJson;
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
