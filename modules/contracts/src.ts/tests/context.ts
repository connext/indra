import { AppChallenge, ChallengeEvents, ChallengeStatus } from "@connext/types";
import {
  ChannelSigner,
  computeAppChallengeHash,
  computeCancelDisputeHash,
  getRandomAddress,
  getRandomBytes32,
  toBN,
} from "@connext/utils";
import { BigNumberish, Contract, ContractFactory, Wallet, constants, utils } from "ethers";

import { AppWithAction, ChallengeRegistry } from "../artifacts";

import {
  ActionType,
  AppWithCounterAction,
  AppWithCounterClass,
  AppWithCounterState,
  encodeAction,
  encodeOutcome,
  encodeState,
  emptyChallenge,
  expect,
  provider,
  sortSignaturesBySignerAddress,
} from "./utils";

const { Zero, One, HashZero } = constants;
const { keccak256 } = utils;

export const setupContext = async (givenAppDefinition?: Contract) => {
  // 0xaeF082d339D227646DB914f0cA9fF02c8544F30b
  const alice = new Wallet("0x3570f77380e22f8dc2274d8fd33e7830cc2d29cf76804e8c21f4f7a6cc571d27");
  // 0xb37e49bFC97A948617bF3B63BC6942BB15285715
  const bob = new Wallet("0x4ccac8b1e81fb18a98bbaf29b9bfe307885561f71b76bd4680d7aec9d0ddfcfd");

  // NOTE: sometimes using the [0] indexed wallet will fail to deploy the
  // contracts in the first test suite (almost like a promised tx isnt
  // completed). Hacky fix: use a different wallet
  const deployer = (await provider.getWallets())[2];

  // app helpers
  const ONCHAIN_CHALLENGE_TIMEOUT = 30;
  const DEFAULT_TIMEOUT = 10;
  const CHANNEL_NONCE = 42;

  // We don't compute or verify the multisig address
  const multisigAddress = getRandomAddress();

  ////////////////////////////////////////
  // Internal Helpers

  const appRegistry = await new ContractFactory(
    ChallengeRegistry.abi,
    ChallengeRegistry.bytecode,
    deployer,
  ).deploy();
  await appRegistry.deployed();

  const appDefinition =
    givenAppDefinition ||
    (await new ContractFactory(AppWithAction.abi, AppWithAction.bytecode, deployer).deploy());
  await appDefinition.deployed();

  const appInstance = new AppWithCounterClass(
    [alice.address, bob.address],
    multisigAddress,
    appDefinition.address,
    DEFAULT_TIMEOUT,
    CHANNEL_NONCE,
  );

  const getSignatures = async (digest: string): Promise<string[]> =>
    await sortSignaturesBySignerAddress(digest, [
      await new ChannelSigner(bob.privateKey).signMessage(digest),
      await new ChannelSigner(alice.privateKey).signMessage(digest),
    ]);

  ////////////////////////////////////////
  // Exported Methods

  const getChallenge = async (): Promise<AppChallenge> => {
    const [status, appStateHash, versionNumber, finalizesAt] = await appRegistry.getAppChallenge(
      appInstance.identityHash,
    );
    return { status, appStateHash, versionNumber, finalizesAt };
  };

  const getOutcome = async (): Promise<string> => appRegistry.getOutcome(appInstance.identityHash);

  const verifyChallenge = async (expected: Partial<AppChallenge>) => {
    expect(await getChallenge()).to.containSubset(expected);
  };

  const isProgressable = async () =>
    appRegistry.isProgressable(await getChallenge(), appInstance.defaultTimeout);

  const isDisputable = async (challenge?: AppChallenge) =>
    appRegistry.isDisputable(challenge || (await getChallenge()));

  const isFinalized = async () =>
    appRegistry.isFinalized(await getChallenge(), appInstance.defaultTimeout);

  const isCancellable = async (challenge?: AppChallenge) =>
    appRegistry.isCancellable(challenge || (await getChallenge()), appInstance.defaultTimeout);

  const hasPassed = (timeout: BigNumberish) => appRegistry.hasPassed(toBN(timeout));

  const verifySignatures = async (
    digest: string = getRandomBytes32(),
    signatures?: string[],
    signers?: string[],
  ) =>
    appRegistry.verifySignatures(
      signatures || (await getSignatures(digest)),
      digest,
      signers || [alice.address, bob.address],
    );

  const wrapInEventVerification = async (
    contractCall: any,
    expected: Partial<AppChallenge> = {},
  ) => {
    const { status, appStateHash, finalizesAt, versionNumber } = await getChallenge();
    await expect(contractCall)
      .to.emit(appRegistry, ChallengeEvents.ChallengeUpdated)
      .withArgs(
        appInstance.identityHash, // identityHash
        expected.status || status, // status
        expected.appStateHash || appStateHash, // appStateHash
        expected.versionNumber || versionNumber, // versionNumber
        expected.finalizesAt || finalizesAt, // finalizesAt
      );
  };

  // State Progression methods
  const setOutcome = async (encodedFinalState?: string): Promise<void> =>
    wrapInEventVerification(
      appRegistry.setOutcome(appInstance.appIdentity, encodedFinalState || HashZero),
      { status: ChallengeStatus.OUTCOME_SET },
    );

  const setOutcomeAndVerify = async (encodedFinalState?: string): Promise<void> => {
    await setOutcome(encodedFinalState);
    expect(await getOutcome()).to.eq(encodeOutcome());
    await verifyChallenge({ status: ChallengeStatus.OUTCOME_SET });
  };

  const setState = async (
    versionNumber: number,
    appState?: string,
    timeout: number = ONCHAIN_CHALLENGE_TIMEOUT,
  ) => {
    const stateHash = keccak256(appState || HashZero);
    const digest = computeAppChallengeHash(
      appInstance.identityHash,
      stateHash,
      versionNumber,
      timeout,
    );
    const call = appRegistry.setState(appInstance.appIdentity, {
      versionNumber,
      appStateHash: stateHash,
      timeout,
      signatures: await getSignatures(digest),
    });
    const blockNumber = await provider.getBlockNumber();
    // FIXME: why is this off by one?
    const finalizesAt = toBN(blockNumber).add(timeout).add(1);
    await wrapInEventVerification(call, {
      status: ChallengeStatus.IN_DISPUTE,
      appStateHash: stateHash,
      versionNumber: toBN(versionNumber),
      finalizesAt,
    });
  };

  const setStateAndVerify = async (
    versionNumber: number,
    appState?: string,
    timeout: number = ONCHAIN_CHALLENGE_TIMEOUT,
  ) => {
    await setState(versionNumber, appState, timeout);
    await verifyChallenge({
      versionNumber: toBN(versionNumber),
      appStateHash: keccak256(appState || HashZero),
      status: ChallengeStatus.IN_DISPUTE,
    });
  };

  const progressState = async (
    state: AppWithCounterState,
    action: AppWithCounterAction,
    signer: Wallet,
    resultingState?: AppWithCounterState,
    resultingStateVersionNumber?: BigNumberish,
    resultingStateTimeout?: number,
  ) => {
    resultingState = resultingState ?? {
      counter:
        action.actionType === ActionType.ACCEPT_INCREMENT
          ? state.counter
          : state.counter.add(action.increment),
    };
    const resultingStateHash = keccak256(encodeState(resultingState));
    resultingStateVersionNumber =
      resultingStateVersionNumber ?? (await getChallenge()).versionNumber.add(One);
    resultingStateTimeout = resultingStateTimeout ?? 0;
    const digest = computeAppChallengeHash(
      appInstance.identityHash,
      resultingStateHash,
      resultingStateVersionNumber,
      resultingStateTimeout,
    );
    const req = {
      appStateHash: resultingStateHash,
      versionNumber: resultingStateVersionNumber,
      timeout: resultingStateTimeout,
      signatures: [await new ChannelSigner(signer.privateKey).signMessage(digest)],
    };
    const blockNumber = await provider.getBlockNumber();
    const timeout = appInstance.defaultTimeout;
    // FIXME: why is this off by one?
    const finalizesAt = toBN(blockNumber).add(timeout).add(1);
    await wrapInEventVerification(
      appRegistry.progressState(
        appInstance.appIdentity,
        req,
        encodeState(state),
        encodeAction(action),
      ),
      {
        status: resultingState.counter.gt(5)
          ? ChallengeStatus.EXPLICITLY_FINALIZED
          : ChallengeStatus.IN_ONCHAIN_PROGRESSION,
        appStateHash: resultingStateHash,
        versionNumber: toBN(resultingStateVersionNumber),
        finalizesAt,
      },
    );
  };

  const progressStateAndVerify = async (
    state: AppWithCounterState,
    action: AppWithCounterAction,
    signer: Wallet = bob,
  ) => {
    const existingChallenge = await getChallenge();
    expect(await isProgressable()).to.be.true;
    const resultingState: AppWithCounterState = {
      counter:
        action.actionType === ActionType.ACCEPT_INCREMENT
          ? state.counter
          : state.counter.add(action.increment),
    };
    const resultingStateHash = keccak256(encodeState(resultingState));
    const explicitlyFinalized = resultingState.counter.gt(5);
    const status = explicitlyFinalized
      ? ChallengeStatus.EXPLICITLY_FINALIZED
      : ChallengeStatus.IN_ONCHAIN_PROGRESSION;
    const expected = {
      appStateHash: resultingStateHash,
      versionNumber: existingChallenge.versionNumber.add(One),
      status,
    };
    await progressState(state, action, signer);
    await verifyChallenge(expected);
    expect(await isProgressable()).to.be.equal(!explicitlyFinalized);
  };

  const setAndProgressStateAndVerify = async (
    versionNumber: number,
    state: AppWithCounterState,
    action: AppWithCounterAction,
    timeout: number = 0,
    turnTaker: Wallet = bob,
  ) => {
    await setAndProgressState(versionNumber, state, action, timeout, turnTaker);
    const resultingState: AppWithCounterState = {
      counter:
        action.actionType === ActionType.ACCEPT_INCREMENT
          ? state.counter
          : state.counter.add(action.increment),
    };
    const resultingStateHash = keccak256(encodeState(resultingState));
    const status = resultingState.counter.gt(5)
      ? ChallengeStatus.EXPLICITLY_FINALIZED
      : ChallengeStatus.IN_ONCHAIN_PROGRESSION;
    await verifyChallenge({
      appStateHash: resultingStateHash,
      versionNumber: One.add(versionNumber),
      status,
    });
    expect(await isProgressable()).to.be.equal(status === ChallengeStatus.IN_ONCHAIN_PROGRESSION);
  };

  // No need to verify events here because `setAndProgress` simply emits
  // the events from other contracts
  const setAndProgressState = async (
    versionNumber: number,
    state: AppWithCounterState,
    action: AppWithCounterAction,
    timeout: number = 0,
    turnTaker: Wallet = bob,
  ) => {
    const stateHash = keccak256(encodeState(state));
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
    const timeout2 = 0;
    const resultingStateHash = keccak256(encodeState(resultingState));
    const resultingStateDigest = computeAppChallengeHash(
      appInstance.identityHash,
      resultingStateHash,
      One.add(versionNumber),
      timeout2,
    );
    const req1 = {
      versionNumber,
      appStateHash: stateHash,
      timeout,
      signatures: await getSignatures(stateDigest),
    };
    const req2 = {
      versionNumber: One.add(versionNumber),
      appStateHash: resultingStateHash,
      timeout: timeout2,
      signatures: [await new ChannelSigner(turnTaker.privateKey).signMessage(resultingStateDigest)],
    };
    await appRegistry.setAndProgressState(
      appInstance.appIdentity,
      req1,
      req2,
      encodeState(state),
      encodeAction(action),
    );
  };

  // TODO: why does event verification fail?
  // await wrapInEventVerification(
  const cancelDispute = async (versionNumber: number, signatures?: string[]): Promise<void> => {
    const digest = computeCancelDisputeHash(appInstance.identityHash, toBN(versionNumber));
    await appRegistry.cancelDispute(appInstance.appIdentity, {
      versionNumber: toBN(versionNumber),
      signatures: signatures || (await getSignatures(digest)),
    });
  };

  const cancelDisputeAndVerify = async (
    versionNumber: number,
    signatures?: string[],
  ): Promise<void> => {
    await cancelDispute(versionNumber, signatures);
    await verifyChallenge(emptyChallenge);
  };

  return {
    // app defaults
    alice,
    appRegistry,
    bob,
    state0: { counter: Zero },
    state1: { counter: toBN(2) },
    action: { actionType: ActionType.SUBMIT_COUNTER_INCREMENT, increment: toBN(2) },
    explicitlyFinalizingAction: {
      actionType: ActionType.SUBMIT_COUNTER_INCREMENT,
      increment: toBN(6),
    },
    ONCHAIN_CHALLENGE_TIMEOUT,
    DEFAULT_TIMEOUT,
    appInstance,
    // helper fns
    getChallenge,
    verifyChallenge,
    verifyEmptyChallenge: () => verifyChallenge(emptyChallenge),
    isProgressable,
    isFinalized,
    isCancellable,
    hasPassed,
    isDisputable,
    verifySignatures,
    // state progression
    setOutcome,
    setOutcomeAndVerify,
    setState,
    setStateAndVerify,
    progressState,
    progressStateAndVerify,
    setAndProgressState,
    setAndProgressStateAndVerify,
    cancelDispute,
    cancelDisputeAndVerify,
  };
};
