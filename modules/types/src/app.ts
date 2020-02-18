import { Address, BigNumber, BigNumberish, SolidityValueType } from "./basic";
import { CFCoreChannel } from "./channel";
import {
  MultiAssetMultiPartyCoinTransferInterpreterParams,
  OutcomeType,
  SingleAssetTwoPartyCoinTransferInterpreterParams,
  TwoPartyFixedOutcomeInterpreterParams,
} from "./contracts";
import { CFCoreTypes } from "./cfCore";

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
  intermediaryIdentifier?: string;
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
  isVirtualApp: boolean;
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
  intermediaryIdentifier?: string;
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

export type MatchAppInstanceResponse = {
  matchedApp: DefaultApp;
  proposeParams: CFCoreTypes.ProposeInstallParams;
  appInstanceId: string;
};

////////////////////////////////////
////// App Registry

export const CoinBalanceRefundApp = "CoinBalanceRefundApp";
export const SimpleLinkedTransferApp = "SimpleLinkedTransferApp";
export const SimpleTransferApp = "SimpleTransferApp";
export const SimpleTwoPartySwapApp = "SimpleTwoPartySwapApp";

export const SupportedApplications = {
  [CoinBalanceRefundApp]: CoinBalanceRefundApp,
  [SimpleLinkedTransferApp]: SimpleLinkedTransferApp,
  [SimpleTransferApp]: SimpleTransferApp,
  [SimpleTwoPartySwapApp]: SimpleTwoPartySwapApp,
};
export type SupportedApplication = keyof typeof SupportedApplications;

export type DefaultApp = {
  actionEncoding?: string;
  allowNodeInstall: boolean;
  appDefinitionAddress: string;
  name: SupportedApplication;
  chainId: number;
  outcomeType: OutcomeType;
  stateEncoding: string;
};

export type AppRegistry = DefaultApp[];

////////////////////////////////////
// Generic Apps

export type App<T = string> = {
  id: number;
  channel: CFCoreChannel;
  appRegistry: DefaultApp; // TODO: is this right?
  appId: number;
  xpubPartyA: string;
  xpubPartyB: string;
  depositA: T;
  depositB: T;
  intermediaries: string[];
  initialState: any; // TODO: BAD!!
  timeout: number;
  updates: AppUpdate[];
};
export type AppBigNumber = App<BigNumber>;

export type AppUpdate<T = string> = {
  id: number;
  app: App<T>;
  action: any; // TODO: BAD!!
  sigs: string[];
};
export type AppUpdateBigNumber = AppUpdate<BigNumber>;

export type CoinTransfer<T = string> = {
  amount: T;
  to: Address; // NOTE: must be the xpub!!!
};
export type CoinTransferBigNumber = CoinTransfer<BigNumber>;

// all the types of cf app states
export type AppState<T = string> =
  | SimpleTransferAppState<T>
  | SimpleLinkedTransferAppState<T>
  | SimpleSwapAppState<T>;
export type AppStateBigNumber = AppState<BigNumber>;

// all the types of cf app actions
export type AppAction<T = string> = SimpleLinkedTransferAppAction | SolidityValueType;
export type AppActionBigNumber = AppAction<BigNumber> | SolidityValueType;

////////////////////////////////////
// Swap Apps

export type SimpleSwapAppState<T = string> = {
  coinTransfers: CoinTransfer<T>[][];
};
export type SimpleSwapAppStateBigNumber = SimpleSwapAppState<BigNumber>;

////////////////////////////////////
// Simple Transfer Apps

export type SimpleTransferAppState<T = string> = {
  coinTransfers: CoinTransfer<T>[];
};
export type SimpleTransferAppStateBigNumber = SimpleTransferAppState<BigNumber>;

////////////////////////////////////
// Simple Linked Transfer Apps

export type SimpleLinkedTransferAppState<T = string> = {
  coinTransfers: CoinTransfer<T>[];
  linkedHash: string;
  amount: T;
  assetId: string;
  paymentId: string;
  preImage: string;
};
export type SimpleLinkedTransferAppStateBigNumber = SimpleLinkedTransferAppState<BigNumber>;
export type SimpleLinkedTransferAppAction = {
  preImage: string;
};

////////////////////////////////////
// Unidirectional Transfer Apps

export type UnidirectionalTransferAppState<T = string> = {
  finalized: false;
  transfers: [CoinTransfer<T>, CoinTransfer<T>];
  stage: UnidirectionalTransferAppStage;
  turnNum: T;
};
export type UnidirectionalTransferAppStateBigNumber = UnidirectionalTransferAppState<BigNumber>;

export enum UnidirectionalTransferAppActionType {
  SEND_MONEY,
  END_CHANNEL,
}

export type UnidirectionalTransferAppAction<T = string> = {
  actionType: UnidirectionalTransferAppActionType;
  amount: T;
};

export enum UnidirectionalTransferAppStage {
  POST_FUND,
  MONEY_SENT,
  CHANNEL_CLOSED,
}

////////////////////////////////////
// Unidirectional Linked Transfer Apps

export type UnidirectionalLinkedTransferAppState<T = string> = {
  stage: UnidirectionalLinkedTransferAppStage;
  transfers: [CoinTransfer<T>, CoinTransfer<T>];
  linkedHash: string;
  turnNum: T;
  finalized: false;
};
export type UnidirectionalLinkedTransferAppStateBigNumber = UnidirectionalLinkedTransferAppState<
  BigNumber
>;

export type UnidirectionalLinkedTransferAppAction<T = string> = {
  amount: T;
  assetId: Address;
  paymentId: string;
  preImage: string;
};

export type UnidirectionalLinkedTransferAppActionBigNumber = UnidirectionalLinkedTransferAppAction<
  BigNumber
>;

export enum UnidirectionalLinkedTransferAppStage {
  POST_FUND,
  PAYMENT_CLAIMED,
  CHANNEL_CLOSED,
}

////////////////////////////////////
// CoinBalanceRefund

export type CoinBalanceRefundAppState<T = string> = {
  multisig: string;
  recipient: string;
  threshold: T;
  tokenAddress: string;
};
export type CoinBalanceRefundAppStateBigNumber = CoinBalanceRefundAppState<BigNumber>;
