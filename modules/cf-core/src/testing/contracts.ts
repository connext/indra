import AppWithAction from "@connext/contracts/build/AppWithAction.json";
import ChallengeRegistry from "@connext/contracts/build/ChallengeRegistry.json";
import CounterfactualApp from "@connext/contracts/build/CounterfactualApp.json";
import SimpleTransferApp from "@connext/contracts/build/SimpleTransferApp.json";
import TicTacToeApp from "@connext/contracts/build/TicTacToeApp.json";
import UnidirectionalLinkedTransferApp from "@connext/contracts/build/UnidirectionalLinkedTransferApp.json";
import UnidirectionalTransferApp from "@connext/contracts/build/UnidirectionalTransferApp.json";
import DepositApp from "@connext/contracts/build/DepositApp.json";
import WithdrawApp from "@connext/contracts/build/WithdrawApp.json";
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
import TwoPartyFixedOutcomeInterpreter from "@connext/contracts/build/TwoPartyFixedOutcomeInterpreter.json";
import { NetworkContext } from "@connext/types";
import { ContractFactory, Wallet } from "ethers";
import { JsonRpcProvider } from "ethers/providers";

export type NetworkContextForTestSuite = NetworkContext & {
  provider: JsonRpcProvider;
  TicTacToeApp: string;
  DolphinCoin: string;
  UnidirectionalTransferApp: string;
  UnidirectionalLinkedTransferApp: string;
  SimpleTransferApp: string;
  WithdrawApp: string;
  DepositApp: string;
};

export const deployTestArtifactsToChain = async (wallet: Wallet): Promise<any> => {
  const depositAppContract = await new ContractFactory(
    DepositApp.abi,
    DepositApp.bytecode,
    wallet,
  ).deploy();

  const withdrawAppContract = await new ContractFactory(
    WithdrawApp.abi,
    WithdrawApp.bytecode,
    wallet,
  ).deploy();

  const dolphinCoin = await new ContractFactory(
    DolphinCoin.abi,
    DolphinCoin.bytecode,
    wallet,
  ).deploy();

  const identityApp = await new ContractFactory(
    IdentityApp.abi,
    IdentityApp.bytecode,
    wallet,
  ).deploy();

  const mvmContract = await new ContractFactory(
    MinimumViableMultisig.abi as any,
    MinimumViableMultisig.bytecode,
    wallet,
  ).deploy();

  const proxyFactoryContract = await new ContractFactory(
    ProxyFactory.abi,
    ProxyFactory.bytecode,
    wallet,
  ).deploy();

  const coinTransferETHInterpreter = await new ContractFactory(
    MultiAssetMultiPartyCoinTransferInterpreter.abi,
    MultiAssetMultiPartyCoinTransferInterpreter.bytecode,
    wallet,
  ).deploy();

  const twoPartyFixedOutcomeInterpreter = await new ContractFactory(
    TwoPartyFixedOutcomeInterpreter.abi,
    TwoPartyFixedOutcomeInterpreter.bytecode,
    wallet,
  ).deploy();

  const challengeRegistry = await new ContractFactory(
    ChallengeRegistry.abi,
    ChallengeRegistry.bytecode,
    wallet,
  ).deploy();

  const conditionalTransactionDelegateTarget = await new ContractFactory(
    ConditionalTransactionDelegateTarget.abi,
    ConditionalTransactionDelegateTarget.bytecode,
    wallet,
  ).deploy();

  const tttContract = await new ContractFactory(
    TicTacToeApp.abi,
    TicTacToeApp.bytecode,
    wallet,
  ).deploy();

  const transferContract = await new ContractFactory(
    UnidirectionalTransferApp.abi,
    UnidirectionalTransferApp.bytecode,
    wallet,
  ).deploy();

  const simpleTransferContract = await new ContractFactory(
    SimpleTransferApp.abi,
    SimpleTransferApp.bytecode,
    wallet,
  ).deploy();

  const linkContract = await new ContractFactory(
    UnidirectionalLinkedTransferApp.abi,
    UnidirectionalLinkedTransferApp.bytecode,
    wallet,
  ).deploy();

  const timeLockedPassThrough = await new ContractFactory(
    TimeLockedPassThrough.abi,
    TimeLockedPassThrough.bytecode,
    wallet,
  ).deploy();

  const singleAssetTwoPartyCoinTransferInterpreter = await new ContractFactory(
    SingleAssetTwoPartyCoinTransferInterpreter.abi,
    SingleAssetTwoPartyCoinTransferInterpreter.bytecode,
    wallet,
  ).deploy();

  return {
    provider: wallet.provider as JsonRpcProvider,
    ChallengeRegistry: challengeRegistry.address,
    ConditionalTransactionDelegateTarget: conditionalTransactionDelegateTarget.address,
    DolphinCoin: dolphinCoin.address,
    DepositApp: depositAppContract.address,
    IdentityApp: identityApp.address,
    MinimumViableMultisig: mvmContract.address,
    MultiAssetMultiPartyCoinTransferInterpreter: coinTransferETHInterpreter.address,
    ProxyFactory: proxyFactoryContract.address,
    SimpleTransferApp: simpleTransferContract.address,
    SingleAssetTwoPartyCoinTransferInterpreter: singleAssetTwoPartyCoinTransferInterpreter.address,
    TicTacToeApp: tttContract.address,
    TimeLockedPassThrough: timeLockedPassThrough.address,
    TwoPartyFixedOutcomeInterpreter: twoPartyFixedOutcomeInterpreter.address,
    UnidirectionalLinkedTransferApp: linkContract.address,
    UnidirectionalTransferApp: transferContract.address,
    WithdrawApp: withdrawAppContract.address,
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
