// export all currently used addresses
import * as addressBook from "./address-book.json";
import * as addressHistory from "./address-history.json";

// export all build artifacts
import * as AppWithAction from "./build/AppWithAction.json";
import * as ChallengeRegistry from "./build/ChallengeRegistry.json";
import * as ConditionalTransactionDelegateTarget from "./build/ConditionalTransactionDelegateTarget.json";
import * as CounterfactualApp from "./build/CounterfactualApp.json";
import * as DepositApp from "./build/DepositApp.json";
import * as DolphinCoin from "./build/DolphinCoin.json";
import * as ERC20 from "./build/ERC20.json";
import * as HashLockTransferApp from "./build/HashLockTransferApp.json";
import * as IdentityApp from "./build/IdentityApp.json";
import * as MinimumViableMultisig from "./build/MinimumViableMultisig.json";
import * as MultiAssetMultiPartyCoinTransferInterpreter from "./build/MultiAssetMultiPartyCoinTransferInterpreter.json";
import * as ProxyFactory from "./build/ProxyFactory.json";
import * as SimpleLinkedTransferApp from "./build/SimpleLinkedTransferApp.json";
import * as SimpleSignedTransferApp from "./build/SimpleSignedTransferApp.json";
import * as SimpleTwoPartySwapApp from "./build/SimpleTwoPartySwapApp.json";
import * as SingleAssetTwoPartyCoinTransferInterpreter from "./build/SingleAssetTwoPartyCoinTransferInterpreter.json";
import * as TicTacToeApp from "./build/TicTacToeApp.json";
import * as TimeLockedPassThrough from "./build/TimeLockedPassThrough.json";
import * as TwoPartyFixedOutcomeInterpreter from "./build/TwoPartyFixedOutcomeInterpreter.json";
import * as WithdrawApp from "./build/WithdrawApp.json";

export * from "./commitments";
export {
  addressBook,
  addressHistory,
  AppWithAction,
  ChallengeRegistry,
  ConditionalTransactionDelegateTarget,
  CounterfactualApp,
  DepositApp,
  DolphinCoin,
  ERC20,
  HashLockTransferApp,
  IdentityApp,
  MinimumViableMultisig,
  MultiAssetMultiPartyCoinTransferInterpreter,
  ProxyFactory,
  SimpleLinkedTransferApp,
  SimpleSignedTransferApp,
  SimpleTwoPartySwapApp,
  SingleAssetTwoPartyCoinTransferInterpreter,
  TicTacToeApp,
  TimeLockedPassThrough,
  TwoPartyFixedOutcomeInterpreter,
  WithdrawApp,
};
