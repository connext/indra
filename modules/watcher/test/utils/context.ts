import { ChallengeRegistry, AppWithAction } from "@connext/contracts";
import { JsonRpcProvider, BigNumber } from "@connext/types";
import { getRandomAddress, computeAppChallengeHash, ChannelSigner } from "@connext/utils";
import { Wallet, ContractFactory } from "ethers";
import { constants, utils } from "ethers";

import {
  AppWithCounterClass,
  AppWithCounterState,
  AppWithCounterAction,
  ActionType,
} from "./appWithCounter";

/////////////////////////////
// Context

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
  const multisigAddress = getRandomAddress();

  const appInstance = new AppWithCounterClass(
    [channelInitiator.address, channelResponder.address],
    multisigAddress,
    onchainApp.address,
    constants.One, // default timeout
    constants.One, // channel nonce
  );

  // contract helper functions
  const setState = async (versionNumber: BigNumber, timeout: BigNumber, appState: string) => {
    const stateHash = utils.keccak256(appState);
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
    timeout: BigNumber = constants.Zero,
    turnTaker: Wallet = channelResponder,
  ) => {
    const stateHash = utils.keccak256(AppWithCounterClass.encodeState(state));
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
    const timeout2 = constants.Zero;
    const resultingStateHash = utils.keccak256(AppWithCounterClass.encodeState(resultingState));
    const resultingStateDigest = computeAppChallengeHash(
      appInstance.identityHash,
      resultingStateHash,
      constants.One.add(versionNumber),
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
      versionNumber: constants.One.add(versionNumber),
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
