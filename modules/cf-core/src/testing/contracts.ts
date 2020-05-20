import {
  ChallengeRegistry,
  ConditionalTransactionDelegateTarget,
  DepositApp,
  DolphinCoin,
  IdentityApp,
  MinimumViableMultisig,
  MultiAssetMultiPartyCoinTransferInterpreter,
  ProxyFactory,
  SimpleTransferApp,
  SingleAssetTwoPartyCoinTransferInterpreter,
  TicTacToeApp,
  TimeLockedPassThrough,
  TwoPartyFixedOutcomeInterpreter,
  UnidirectionalLinkedTransferApp,
  UnidirectionalTransferApp,
  WithdrawApp,
} from "@connext/contracts";
import { ContractAddresses } from "@connext/types";
import { ContractFactory, Wallet } from "ethers";
import { JsonRpcProvider } from "ethers/providers";

export type TestContractAddresses = ContractAddresses & {
  ticTacToeApp: string;
  dolphinCoin: string;
  unidirectionalTransferApp: string;
  unidirectionalLinkedTransferApp: string;
  simpleTransferApp: string;
  withdrawApp: string;
  depositApp: string;
};

export type TestNetworkContext = {
  provider: JsonRpcProvider;
  contractAddresses: TestContractAddresses;
};

export const deployTestArtifactsToChain = async (
  wallet: Wallet,
): Promise<TestContractAddresses> => {

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
    challengeRegistry: challengeRegistry.address,
    conditionalTransactionDelegateTarget: conditionalTransactionDelegateTarget.address,
    dolphinCoin: dolphinCoin.address,
    depositApp: depositAppContract.address,
    identityApp: identityApp.address,
    minimumViableMultisig: mvmContract.address,
    multiAssetMultiPartyCoinTransferInterpreter: coinTransferETHInterpreter.address,
    proxyFactory: proxyFactoryContract.address,
    simpleTransferApp: simpleTransferContract.address,
    singleAssetTwoPartyCoinTransferInterpreter: singleAssetTwoPartyCoinTransferInterpreter.address,
    ticTacToeApp: tttContract.address,
    timeLockedPassThrough: timeLockedPassThrough.address,
    twoPartyFixedOutcomeInterpreter: twoPartyFixedOutcomeInterpreter.address,
    unidirectionalLinkedTransferApp: linkContract.address,
    unidirectionalTransferApp: transferContract.address,
    withdrawApp: withdrawAppContract.address,
  };
};
