import {
  AppChallenge,
  ChallengeStatus,
  ChallengeEvents,
} from "@connext/types";
import {
  ChannelSigner,
  getRandomAddress,
  getRandomBytes32,
  toBN,
} from "@connext/utils";
import { Wallet, Contract } from "ethers";
import { Zero, One, HashZero } from "ethers/constants";
import { keccak256, BigNumberish } from "ethers/utils";

import {
  provider,
  AppWithCounterState,
  AppWithCounterAction,
  ActionType,
  expect,
  AppWithCounterClass,
  encodeState,
  encodeAction,
  computeAppChallengeHash,
  EMPTY_CHALLENGE,
  encodeOutcome,
  computeCancelDisputeHash,
} from "./index";
import { sortSignaturesBySignerAddress } from "../../utils";

export const setupContext = async (
  appRegistry: Contract,
  appDefinition: Contract,
  providedWallet?: Wallet,
) => {
  // 0xaeF082d339D227646DB914f0cA9fF02c8544F30b
  const alice = new Wallet("0x3570f77380e22f8dc2274d8fd33e7830cc2d29cf76804e8c21f4f7a6cc571d27");
  // 0xb37e49bFC97A948617bF3B63BC6942BB15285715
  const bob = new Wallet("0x4ccac8b1e81fb18a98bbaf29b9bfe307885561f71b76bd4680d7aec9d0ddfcfd");

  // app helpers
  const ONCHAIN_CHALLENGE_TIMEOUT = 30;
  const DEFAULT_TIMEOUT = 10;
  const CHANNEL_NONCE = parseInt((Math.random() * 100).toString().split(".")[0]);

  // multisig address helpers
  const multisigAddress = getRandomAddress(); // doesn't matter exactly what this is

  const appInstance = new AppWithCounterClass(
    [alice.address, bob.address],
    multisigAddress,
    appDefinition.address,
    DEFAULT_TIMEOUT, // default timeout
    CHANNEL_NONCE, // channel nonce
  );

  // Contract helpers
  const getChallenge = async (): Promise<AppChallenge> => {
    const [
      status,
      appStateHash,
      versionNumber,
      finalizesAt,
    ] = await appRegistry.functions.getAppChallenge(appInstance.identityHash);
    return {
      status,
      appStateHash,
      versionNumber,
      finalizesAt,
    };
  };

  const getOutcome = async (): Promise<string> => {
    const outcome = await appRegistry.functions.getOutcome(appInstance.identityHash);
    return outcome;
  };

  const verifyChallenge = async (expected: Partial<AppChallenge>) => {
    const challenge = await getChallenge();
    expect(challenge).to.containSubset(expected);
  };

  const isProgressable = async () => {
    const challenge = await getChallenge();
    return appRegistry.functions.isProgressable(challenge, appInstance.defaultTimeout);
  };

  const isDisputable = async (challenge?: AppChallenge) => {
    if (!challenge) {
      challenge = await getChallenge();
    }
    return appRegistry.functions.isDisputable(challenge);
  };

  const isFinalized = async () => {
    const challenge = await getChallenge();
    return appRegistry.functions.isFinalized(challenge, appInstance.defaultTimeout);
  };

  const isCancellable = async (challenge?: AppChallenge) => {
    if (!challenge) {
      challenge = await getChallenge();
    }
    return appRegistry.functions.isCancellable(challenge, appInstance.defaultTimeout);
  };

  const hasPassed = (timeout: BigNumberish) => {
    return appRegistry.functions.hasPassed(toBN(timeout));
  };

  const verifySignatures = async (
    digest: string = getRandomBytes32(),
    signatures?: string[],
    signers?: string[],
  ) => {
    if (!signatures) {
      signatures = await sortSignaturesBySignerAddress(digest, [
        await (new ChannelSigner(bob.privateKey).signMessage(digest)),
        await (new ChannelSigner(alice.privateKey).signMessage(digest)),
      ]);
    }

    if (!signers) {
      signers = [alice.address, bob.address];
    }

    return appRegistry.functions.verifySignatures(signatures, digest, signers);
  };

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
  const setOutcome = async (encodedFinalState?: string): Promise<void> => {
    await wrapInEventVerification(
      appRegistry.functions.setOutcome(appInstance.appIdentity, encodedFinalState || HashZero),
      { status: ChallengeStatus.OUTCOME_SET },
    );
  };

  const setOutcomeAndVerify = async (encodedFinalState?: string): Promise<void> => {
    await setOutcome(encodedFinalState);
    const outcome = await getOutcome();
    expect(outcome).to.eq(encodeOutcome());
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
    const call = appRegistry.functions.setState(appInstance.appIdentity, {
      versionNumber,
      appStateHash: stateHash,
      timeout,
      signatures: await sortSignaturesBySignerAddress(digest, [
        await (new ChannelSigner(alice.privateKey).signMessage(digest)),
        await (new ChannelSigner(bob.privateKey).signMessage(digest)),
      ]),
    });
    await wrapInEventVerification(call, {
      status: ChallengeStatus.IN_DISPUTE,
      appStateHash: stateHash,
      versionNumber: toBN(versionNumber),
      // FIXME: why is this off by one?
      finalizesAt: toBN((await provider.getBlockNumber()) + timeout + 1),
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
    const existingChallenge = await getChallenge();
    resultingState = resultingState ?? {
      counter:
        action.actionType === ActionType.ACCEPT_INCREMENT
          ? state.counter
          : state.counter.add(action.increment),
    };
    const resultingStateHash = keccak256(encodeState(resultingState));
    resultingStateVersionNumber =
      resultingStateVersionNumber ?? existingChallenge.versionNumber.add(One);
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
      signatures: [ await (new ChannelSigner(signer.privateKey).signMessage(digest)) ],
    };
    await wrapInEventVerification(
      appRegistry.functions.progressState(
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
        // FIXME: why is this off by one?
        finalizesAt: toBN((await provider.getBlockNumber()) + appInstance.defaultTimeout + 1),
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
      signatures: await sortSignaturesBySignerAddress(
        stateDigest,
        [
          await (new ChannelSigner(alice.privateKey).signMessage(stateDigest)),
          await (new ChannelSigner(bob.privateKey).signMessage(stateDigest)),
        ],
      ),
    };
    const req2 = {
      versionNumber: One.add(versionNumber),
      appStateHash: resultingStateHash,
      timeout: timeout2,
      signatures: [
        await (new ChannelSigner(turnTaker.privateKey).signMessage(resultingStateDigest)),
      ],
    };
    await appRegistry.functions.setAndProgressState(
      appInstance.appIdentity,
      req1,
      req2,
      encodeState(state),
      encodeAction(action),
    );
  };

  const cancelDispute = async (versionNumber: number, signatures?: string[]): Promise<void> => {
    const digest = computeCancelDisputeHash(appInstance.identityHash, toBN(versionNumber));
    if (!signatures) {
      signatures = await sortSignaturesBySignerAddress(digest, [
        await (new ChannelSigner(alice.privateKey).signMessage(digest)),
        await (new ChannelSigner(bob.privateKey).signMessage(digest)),
      ]);
    }
    // TODO: why does event verification fail?
    // await wrapInEventVerification(
    await appRegistry.functions.cancelDispute(appInstance.appIdentity, {
      versionNumber: toBN(versionNumber),
      signatures,
    });
    //   { ...EMPTY_CHALLENGE },
    // );
  };

  const cancelDisputeAndVerify = async (
    versionNumber: number,
    signatures?: string[],
  ): Promise<void> => {
    await cancelDispute(versionNumber, signatures);
    await verifyChallenge(EMPTY_CHALLENGE);
  };

  return {
    // app defaults
    alice,
    bob,
    state0: { counter: Zero },
    state1: { counter: toBN(2) },
    action: {
      actionType: ActionType.SUBMIT_COUNTER_INCREMENT,
      increment: toBN(2),
    },
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
    verifyEmptyChallenge: () => verifyChallenge(EMPTY_CHALLENGE),
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
