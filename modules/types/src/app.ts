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
  actionEncoding: ABIEncoding | undefined;
  stateEncoding: ABIEncoding;
};

export type AppInstanceJson = {
  abiEncodings: AppABIEncodings;
  appDefinition: Address;
  appSeqNo: number;
  bytecode?: HexString;
  defaultTimeout: HexString;
  identityHash: HexString;
  initiatorDeposit: DecString;
  initiatorDepositAssetId: AssetId;
  initiatorIdentifier: PublicIdentifier;
  latestAction?: any;
  latestState: any;
  latestVersionNumber: number;
  meta?: any;
  multisigAddress: Address;
  outcomeInterpreterParameters:
    | TwoPartyFixedOutcomeInterpreterParamsJson
    | MultiAssetMultiPartyCoinTransferInterpreterParamsJson
    | SingleAssetTwoPartyCoinTransferInterpreterParamsJson;
  outcomeType: OutcomeType;
  responderDeposit: DecString;
  responderDepositAssetId: AssetId;
  responderIdentifier: PublicIdentifier;
  stateTimeout: HexString;
};

////////////////////////////////////
// App Registry

export type DefaultApp = {
  actionEncoding?: ABIEncoding;
  allowNodeInstall: boolean;
  appDefinitionAddress: Address;
  chainId: number;
  name: string;
  outcomeType: OutcomeType;
  stateEncoding: ABIEncoding;
};

export type AppRegistry = DefaultApp[];
