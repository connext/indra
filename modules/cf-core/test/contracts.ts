import AppWithAction from "@connext/contracts/build/AppWithAction.json";
import ChallengeRegistry from "@connext/contracts/build/ChallengeRegistry.json";
import CounterfactualApp from "@connext/contracts/build/CounterfactualApp.json";
import SimpleTransferApp from "@connext/contracts/build/SimpleTransferApp.json";
import TicTacToeApp from "@connext/contracts/build/TicTacToeApp.json";
import UnidirectionalLinkedTransferApp from "@connext/contracts/build/UnidirectionalLinkedTransferApp.json";
import UnidirectionalTransferApp from "@connext/contracts/build/UnidirectionalTransferApp.json";
import CoinBalanceRefundApp from "@connext/contracts/build/CoinBalanceRefundApp.json";
import ConditionalTransactionDelegateTarget from "@connext/contracts/build/ConditionalTransactionDelegateTarget.json";
import DolphinCoin from "@connext/contracts/build/DolphinCoin.json";
import ERC20 from "@connext/contracts/build/ERC20.json";
import IdentityApp from "@connext/contracts/build/IdentityApp.json";
import MinimumViableMultisig from "@connext/contracts/build/MinimumViableMultisig.json";
import MultiAssetMultiPartyCoinTransferInterpreter from "@connext/contracts/build/MultiAssetMultiPartyCoinTransferInterpreter.json";
import Proxy from "@connext/contracts/build/Proxy.json";
import ProxyFactory from "@connext/contracts/build/ProxyFactory.json";
import SingleAssetTwoPartyCoinTransferInterpreter from "@connext/contracts/build/SingleAssetTwoPartyCoinTransferInterpreter.json";
import TimeLockedPassThrough from "@connext/contracts/build/TimeLockedPassThrough.json";
import TwoPartyFixedOutcomeApp from "@connext/contracts/build/TwoPartyFixedOutcomeApp.json";
import TwoPartyFixedOutcomeFromVirtualAppInterpreter from "@connext/contracts/build/TwoPartyFixedOutcomeFromVirtualAppInterpreter.json";
import TwoPartyFixedOutcomeInterpreter from "@connext/contracts/build/TwoPartyFixedOutcomeInterpreter.json";
import { NetworkContext } from "@connext/types";
import { ContractFactory, Wallet } from "ethers";

export type NetworkContextForTestSuite = NetworkContext & {
  TicTacToeApp: string;
  DolphinCoin: string;
  UnidirectionalTransferApp: string;
  UnidirectionalLinkedTransferApp: string;
  SimpleTransferApp: string;
};

export const deployTestArtifactsToChain = async (wallet: Wallet): Promise<any> => {
  const coinBalanceRefundContract = await new ContractFactory(
    CoinBalanceRefundApp.abi,
    CoinBalanceRefundApp.evm.bytecode,
    wallet,
  ).deploy();

  const dolphinCoin = await new ContractFactory(
    DolphinCoin.abi,
    DolphinCoin.evm.bytecode,
    wallet,
  ).deploy();

  const identityApp = await new ContractFactory(
    IdentityApp.abi,
    IdentityApp.evm.bytecode,
    wallet,
  ).deploy();

  const mvmContract = await new ContractFactory(
    MinimumViableMultisig.abi,
    MinimumViableMultisig.evm.bytecode,
    wallet,
  ).deploy();

  const proxyFactoryContract = await new ContractFactory(
    ProxyFactory.abi,
    ProxyFactory.evm.bytecode,
    wallet,
  ).deploy();

  const coinTransferETHInterpreter = await new ContractFactory(
    MultiAssetMultiPartyCoinTransferInterpreter.abi,
    MultiAssetMultiPartyCoinTransferInterpreter.evm.bytecode,
    wallet,
  ).deploy();

  const twoPartyFixedOutcomeInterpreter = await new ContractFactory(
    TwoPartyFixedOutcomeInterpreter.abi,
    TwoPartyFixedOutcomeInterpreter.evm.bytecode,
    wallet,
  ).deploy();

  const challengeRegistry = await new ContractFactory(
    ChallengeRegistry.abi,
    ChallengeRegistry.evm.bytecode,
    wallet,
  ).deploy();

  const conditionalTransactionDelegateTarget = await new ContractFactory(
    ConditionalTransactionDelegateTarget.abi,
    ConditionalTransactionDelegateTarget.evm.bytecode,
    wallet,
  ).deploy();

  const twoPartyFixedOutcomeFromVirtualAppETHInterpreter = await new ContractFactory(
    TwoPartyFixedOutcomeFromVirtualAppInterpreter.abi,
    TwoPartyFixedOutcomeFromVirtualAppInterpreter.evm.bytecode,
    wallet,
  ).deploy();

  const tttContract = await new ContractFactory(
    TicTacToeApp.abi,
    TicTacToeApp.evm.bytecode,
    wallet,
  ).deploy();

  const transferContract = await new ContractFactory(
    UnidirectionalTransferApp.abi,
    UnidirectionalTransferApp.evm.bytecode,
    wallet,
  ).deploy();

  const simpleTransferContract = await new ContractFactory(
    SimpleTransferApp.abi,
    SimpleTransferApp.evm.bytecode,
    wallet,
  ).deploy();

  const linkContract = await new ContractFactory(
    UnidirectionalLinkedTransferApp.abi,
    UnidirectionalLinkedTransferApp.evm.bytecode,
    wallet,
  ).deploy();

  const timeLockedPassThrough = await new ContractFactory(
    TimeLockedPassThrough.abi,
    TimeLockedPassThrough.evm.bytecode,
    wallet,
  ).deploy();

  const singleAssetTwoPartyCoinTransferInterpreter = await new ContractFactory(
    SingleAssetTwoPartyCoinTransferInterpreter.abi,
    SingleAssetTwoPartyCoinTransferInterpreter.evm.bytecode,
    wallet,
  ).deploy();

  return {
    ChallengeRegistry: challengeRegistry.address,
    CoinBalanceRefundApp: coinBalanceRefundContract.address,
    ConditionalTransactionDelegateTarget: conditionalTransactionDelegateTarget.address,
    DolphinCoin: dolphinCoin.address,
    IdentityApp: identityApp.address,
    MinimumViableMultisig: mvmContract.address,
    MultiAssetMultiPartyCoinTransferInterpreter: coinTransferETHInterpreter.address,
    ProxyFactory: proxyFactoryContract.address,
    SimpleTransferApp: simpleTransferContract.address,
    SingleAssetTwoPartyCoinTransferInterpreter: singleAssetTwoPartyCoinTransferInterpreter.address,
    TicTacToeApp: tttContract.address,
    TimeLockedPassThrough: timeLockedPassThrough.address,
    TwoPartyFixedOutcomeFromVirtualAppInterpreter:
      twoPartyFixedOutcomeFromVirtualAppETHInterpreter.address,
    TwoPartyFixedOutcomeInterpreter: twoPartyFixedOutcomeInterpreter.address,
    UnidirectionalLinkedTransferApp: linkContract.address,
    UnidirectionalTransferApp: transferContract.address,
  } as NetworkContextForTestSuite;
};

export {
  AppWithAction,
  ChallengeRegistry,
  ConditionalTransactionDelegateTarget,
  CounterfactualApp,
  DolphinCoin,
  ERC20,
  IdentityApp,
  MinimumViableMultisig,
  Proxy,
  ProxyFactory,
  TwoPartyFixedOutcomeApp,
};
