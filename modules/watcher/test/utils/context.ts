/////////////////////////////

import { JsonRpcProvider, BigNumber } from "@connext/types";
import { Wallet, ContractFactory } from "ethers";
import { ChallengeRegistry, AppWithAction } from "@connext/contracts";
import { createRandomAddress, computeAppChallengeHash, ChannelSigner } from "@connext/utils";
import {
  AppWithCounterClass,
  AppWithCounterState,
  AppWithCounterAction,
  ActionType,
} from "./appWithCounter";
import { One, Zero } from "ethers/constants";
import { keccak256 } from "ethers/utils";

//// Context
export const setupContext = async () => {
  const ethProvider = process.env.ETHPROVIDER_URL;

  // deploy challenge registry + app
  const provider = new JsonRpcProvider(ethProvider);
  const wallet = Wallet.fromMnemonic(process.env.SUGAR_DADDY!).connect(provider);

  const factory = new ContractFactory(ChallengeRegistry.abi, ChallengeRegistry.bytecode, wallet);
  const challengeRegistry = await factory.deploy();
  await challengeRegistry.deployed();

  const appFactory = new ContractFactory(AppWithAction.abi, AppWithAction.bytecode, wallet);
  const onchainApp = await appFactory.deploy();
  await onchainApp.deployed();

  // setup constants
  const channelInitiator = Wallet.createRandom().connect(provider);
  const channelResponder = Wallet.createRandom().connect(provider);
  const multisigAddress = createRandomAddress();

  const appInstance = new AppWithCounterClass(
    [channelInitiator.address, channelResponder.address],
    multisigAddress,
    onchainApp.address,
    One, // default timeout
    One, // channel nonce
  );

  // contract helper functions
  const setState = async (versionNumber: BigNumber, timeout: BigNumber, appState: string) => {
    const stateHash = keccak256(appState);
    const digest = computeAppChallengeHash(
      appInstance.identityHash,
      stateHash,
      versionNumber,
      timeout,
    );
    const signatures = [
      await new ChannelSigner(channelInitiator.privateKey, ethProvider).signMessage(digest),
      await new ChannelSigner(channelResponder.privateKey, ethProvider).signMessage(digest),
    ];
    const tx = await challengeRegistry.functions.setState(appInstance.appIdentity, {
      versionNumber,
      appStateHash: stateHash,
      timeout,
      signatures,
    });
    return tx;
  };

  const setAndProgressState = async (
    versionNumber: BigNumber,
    state: AppWithCounterState,
    action: AppWithCounterAction,
    timeout: BigNumber = Zero,
    turnTaker: Wallet = channelResponder,
  ) => {
    const stateHash = keccak256(AppWithCounterClass.encodeState(state));
    const stateDigest = computeAppChallengeHash(
      appInstance.identityHash,
      stateHash,
      versionNumber,
      timeout,
    );
    const resultingState: AppWithCounterState = {
      counter:
        action.actionType === ActionType.ACCEPT_INCREMENT
          ? state.counter
          : state.counter.add(action.increment),
    };
    const timeout2 = Zero;
    const resultingStateHash = keccak256(AppWithCounterClass.encodeState(resultingState));
    const resultingStateDigest = computeAppChallengeHash(
      appInstance.identityHash,
      resultingStateHash,
      One.add(versionNumber),
      timeout2,
    );

    const signatures = [
      await new ChannelSigner(channelInitiator.privateKey, ethProvider).signMessage(stateDigest),
      await new ChannelSigner(channelResponder.privateKey, ethProvider).signMessage(stateDigest),
    ];

    const req1 = {
      versionNumber,
      appStateHash: stateHash,
      timeout,
      signatures,
    };
    const req2 = {
      versionNumber: One.add(versionNumber),
      appStateHash: resultingStateHash,
      timeout: timeout2,
      signatures: [
        await new ChannelSigner(turnTaker.privateKey, ethProvider).signMessage(
          resultingStateDigest,
        ),
      ],
    };
    return challengeRegistry.functions.setAndProgressState(
      appInstance.appIdentity,
      req1,
      req2,
      AppWithCounterClass.encodeState(state),
      AppWithCounterClass.encodeAction(action),
    );
  };

  return {
    ethProvider,
    challengeRegistry,
    provider,
    wallet,
    channelInitiator,
    channelResponder,
    multisigAddress,
    appInstance,
    setState,
    setAndProgressState,
  };
};
