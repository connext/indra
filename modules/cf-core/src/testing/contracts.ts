import {
  ChallengeRegistry,
  ConditionalTransactionDelegateTarget,
  DepositApp,
  DolphinCoin,
  IdentityApp,
  MinimumViableMultisig,
  MultiAssetMultiPartyCoinTransferInterpreter,
  ProxyFactory,
  SingleAssetTwoPartyCoinTransferInterpreter,
  TicTacToeApp,
  TimeLockedPassThrough,
  TwoPartyFixedOutcomeInterpreter,
  WithdrawApp,
  WithdrawInterpreter,
  SimpleLinkedTransferApp,
} from "@connext/contracts";
import { ContractAddresses } from "@connext/types";
import { ContractFactory, Wallet, providers } from "ethers";

export type TestContractAddresses = ContractAddresses & {
  TicTacToeApp: string;
  DolphinCoin: string;
  SimpleLinkedTransferApp: string;
};

export type TestNetworkContext = {
  provider: providers.JsonRpcProvider;
  contractAddresses: TestContractAddresses;
};

export const deployTestArtifactsToChain = async (
  wallet: Wallet,
): Promise<TestContractAddresses> => {
  const linkedTransferAppContract = await new ContractFactory(
    SimpleLinkedTransferApp.abi,
    SimpleLinkedTransferApp.bytecode,
    wallet,
  ).deploy();

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

  const withdrawInterpreterContract = await new ContractFactory(
    WithdrawInterpreter.abi,
    WithdrawInterpreter.bytecode,
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
    MinimumViableMultisig.abi,
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
    ChallengeRegistry: challengeRegistry.address,
    ConditionalTransactionDelegateTarget: conditionalTransactionDelegateTarget.address,
    DolphinCoin: dolphinCoin.address,
    DepositApp: depositAppContract.address,
    IdentityApp: identityApp.address,
    MinimumViableMultisig: mvmContract.address,
    MultiAssetMultiPartyCoinTransferInterpreter: coinTransferETHInterpreter.address,
    ProxyFactory: proxyFactoryContract.address,
    SingleAssetTwoPartyCoinTransferInterpreter: singleAssetTwoPartyCoinTransferInterpreter.address,
    TicTacToeApp: tttContract.address,
    TimeLockedPassThrough: timeLockedPassThrough.address,
    TwoPartyFixedOutcomeInterpreter: twoPartyFixedOutcomeInterpreter.address,
    WithdrawApp: withdrawAppContract.address,
    WithdrawInterpreter: withdrawInterpreterContract.address,
    SimpleLinkedTransferApp: linkedTransferAppContract.address,
  };
};
