import DepositApp from "@connext/contracts/build/DepositApp.json";
import WithdrawApp from "@connext/contracts/build/WithdrawApp.json";
import {
  AppWithAction,
  ChallengeRegistry,
  ConditionalTransactionDelegateTarget,
  ERC20,
  IdentityApp,
  MinimumViableMultisig,
  MultiAssetMultiPartyCoinTransferInterpreter,
  ProxyFactory,
  SingleAssetTwoPartyCoinTransferInterpreter,
  TimeLockedPassThrough,
  TwoPartyFixedOutcomeInterpreter,
} from "@connext/contracts";
import { NetworkContext } from "@connext/types";
import { BigNumber, ContractFactory, Wallet, providers, utils } from "ethers";
import { toBN } from "@connext/utils";
import { expect } from "./assertions";

export const moveToBlock = async (
  blockNumber: BigNumberish,
  provider: providers.JsonRpcProvider,
) => {
  const desired: BigNumber = toBN(blockNumber);
  const current: BigNumber = toBN(await provider.getBlockNumber());
  if (current.gt(desired)) {
    throw new Error(
      `Already at block ${current.toNumber()}, cannot rewind to ${blockNumber.toString()}`,
    );
  }
  if (current.eq(desired)) {
    return;
  }
  for (const _ of Array(desired.sub(current).toNumber())) {
    await mineBlock(provider);
  }
  const final: BigNumber = toBN(await provider.getBlockNumber());
  expect(final).to.be.eq(desired);
};

export const mineBlock = (provider: providers.JsonRpcProvider) => {
  return new Promise(async (resolve) => {
    provider.once("block", () => resolve());
    await provider.send("evm_mine", []);
  });
};

export type TestNetworkContext = NetworkContext & {
  provider: providers.JsonRpcProvider;
  WithdrawApp: string;
  DepositApp: string;
  AppWithAction: string;
  Token: string;
};

export const deployTestArtifactsToChain = async (wallet: Wallet): Promise<TestNetworkContext> => {
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

  const identityApp = await new ContractFactory(
    IdentityApp.abi,
    IdentityApp.bytecode,
    wallet,
  ).deploy();

  const token = await new ContractFactory(ERC20.abi, ERC20.bytecode, wallet).deploy("", "");

  const appWithCounter = await new ContractFactory(
    AppWithAction.abi,
    AppWithAction.bytecode,
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
    AppWithAction: appWithCounter.address,
    provider: wallet.provider as providers.JsonRpcProvider,
    ChallengeRegistry: challengeRegistry.address,
    ConditionalTransactionDelegateTarget: conditionalTransactionDelegateTarget.address,
    DepositApp: depositAppContract.address,
    IdentityApp: identityApp.address,
    MinimumViableMultisig: mvmContract.address,
    MultiAssetMultiPartyCoinTransferInterpreter: coinTransferETHInterpreter.address,
    ProxyFactory: proxyFactoryContract.address,
    SingleAssetTwoPartyCoinTransferInterpreter: singleAssetTwoPartyCoinTransferInterpreter.address,
    TimeLockedPassThrough: timeLockedPassThrough.address,
    TwoPartyFixedOutcomeInterpreter: twoPartyFixedOutcomeInterpreter.address,
    WithdrawApp: withdrawAppContract.address,
    Token: token.address,
  };
};
