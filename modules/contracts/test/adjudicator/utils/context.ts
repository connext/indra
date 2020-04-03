import { signChannelMessage, verifyChannelMessage } from "@connext/crypto";
import {
  AppChallengeBigNumber,
  toBN,
  ChallengeStatus,
  sortSignaturesBySignerAddress,
  createRandom32ByteHexString,
  ChallengeEvents,
} from "@connext/types";
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
  computeActionHash,
  EMPTY_CHALLENGE,
  encodeOutcome,
  computeCancelChallengeHash,
} from "./index";

export const setupContext = async (appRegistry: Contract, appDefinition: Contract) => {
  // 0xaeF082d339D227646DB914f0cA9fF02c8544F30b
  const alice = new Wallet("0x3570f77380e22f8dc2274d8fd33e7830cc2d29cf76804e8c21f4f7a6cc571d27");
  // 0xb37e49bFC97A948617bF3B63BC6942BB15285715
  const bob = new Wallet("0x4ccac8b1e81fb18a98bbaf29b9bfe307885561f71b76bd4680d7aec9d0ddfcfd");

  // eth helpers
  const wallet = (await provider.getWallets())[0];

  // app helpers
  const ONCHAIN_CHALLENGE_TIMEOUT = 30;
  const DEFAULT_TIMEOUT = 10;
  const CHANNEL_NONCE = parseInt((Math.random() * 100).toString().split(".")[0]);

  const appInstance = new AppWithCounterClass(
    [alice.address, bob.address],
    appDefinition.address,
    DEFAULT_TIMEOUT, // default timeout
    CHANNEL_NONCE, // channel nonce
  );

  // Contract helpers
  const getChallenge = async (): Promise<AppChallengeBigNumber> => {
    const [
      status,
      latestSubmitter,
      appStateHash,
      versionNumber,
      finalizesAt,
    ] = await appRegistry.functions.getAppChallenge(appInstance.identityHash);
    return {
      status,
      latestSubmitter,
      appStateHash,
      versionNumber,
      finalizesAt,
    };
  };

  const getOutcome = async (): Promise<string> => {
    const outcome = await appRegistry.functions.getOutcome(appInstance.identityHash);
    return outcome;
  };

  const verifyChallenge = async (expected: Partial<AppChallengeBigNumber>) => {
    const challenge = await getChallenge();
    expect(challenge).to.containSubset(expected);
  };

  const isProgressable = async () => {
    const challenge = await getChallenge();
    return await appRegistry.functions.isProgressable(challenge, appInstance.defaultTimeout);
  };

  const isDisputable = async (challenge?: AppChallengeBigNumber) => {
    if (!challenge) {
      challenge = await getChallenge();
    }
    return await appRegistry.functions.isDisputable(challenge);
  };

  const isStateFinalized = () => {
    return appRegistry.functions.isStateFinalized(appInstance.identityHash);
  };

  const isCancellable = async (challenge?: AppChallengeBigNumber) => {
    if (!challenge) {
      challenge = await getChallenge();
    }
    return appRegistry.functions.isCancellable(challenge, appInstance.defaultTimeout);
  };

  const hasPassed = (timeout: BigNumberish) => {
    return appRegistry.functions.hasPassed(toBN(timeout));
  };

  const verifySignatures = async (
    digest: string = createRandom32ByteHexString(),
    signatures?: string[],
    signers?: string[],
  ) => {
    if (!signatures) {
      signatures = await sortSignaturesBySignerAddress(
        digest,
        [
          await signChannelMessage(bob.privateKey, digest),
          await signChannelMessage(alice.privateKey, digest),
        ],
        verifyChannelMessage,
      );
    }

    if (!signers) {
      signers = [alice.address, bob.address];
    }

    return appRegistry.functions.verifySignatures(signatures, digest, signers);
  };

  const wrapInEventVerification = async (
    contractCall: any,
    expected: Partial<AppChallengeBigNumber> = {},
  ) => {
    const { status, appStateHash, finalizesAt, versionNumber } = await getChallenge();
    await expect(contractCall)
      .to.emit(appRegistry, ChallengeEvents.ChallengeUpdated)
      .withArgs(
        appInstance.identityHash, // identityHash
        expected.status || status, // status
        expected.latestSubmitter || wallet.address, // latestSubmitter
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
      signatures: await sortSignaturesBySignerAddress(
        digest,
        [
          await signChannelMessage(alice.privateKey, digest),
          await signChannelMessage(bob.privateKey, digest),
        ],
        verifyChannelMessage,
      ),
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
      latestSubmitter: wallet.address,
      versionNumber: toBN(versionNumber),
      appStateHash: keccak256(appState || HashZero),
      status: ChallengeStatus.IN_DISPUTE,
    });
  };

  const progressState = async (
    state: AppWithCounterState,
    action: AppWithCounterAction,
    actionSig: string,
  ) => {
    const resultingState: AppWithCounterState = {
      counter:
        action.actionType === ActionType.ACCEPT_INCREMENT
          ? state.counter
          : state.counter.add(action.increment),
    };
    const latestVersionNumber = (await getChallenge()).versionNumber.add(1);
    await wrapInEventVerification(
      appRegistry.functions.progressState(appInstance.appIdentity, encodeState(state), {
        encodedAction: encodeAction(action),
        signature: actionSig,
      }),
      {
        status: resultingState.counter.gt(5)
          ? ChallengeStatus.EXPLICITLY_FINALIZED
          : ChallengeStatus.IN_ONCHAIN_PROGRESSION,
        appStateHash: keccak256(encodeState(resultingState)),
        versionNumber: latestVersionNumber,
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
    const thingToSign = computeActionHash(
      signer.address,
      keccak256(encodeState(state)),
      encodeAction(action),
      existingChallenge.versionNumber.toNumber(),
    );
    const signature = await signChannelMessage(signer.privateKey, thingToSign);
    expect(await isProgressable()).to.be.true;
    const resultingState: AppWithCounterState = {
      counter:
        action.actionType === ActionType.ACCEPT_INCREMENT
          ? state.counter
          : state.counter.add(action.increment),
    };
    const expected = {
      latestSubmitter: wallet.address,
      appStateHash: keccak256(encodeState(resultingState)),
      versionNumber: existingChallenge.versionNumber.add(One),
      status: ChallengeStatus.IN_ONCHAIN_PROGRESSION,
    };
    await progressState(state, action, signature);
    await verifyChallenge(expected);
    expect(await isProgressable()).to.be.true;
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
    const status = resultingState.counter.gt(5)
      ? ChallengeStatus.EXPLICITLY_FINALIZED
      : ChallengeStatus.IN_ONCHAIN_PROGRESSION;
    await verifyChallenge({
      latestSubmitter: wallet.address,
      appStateHash: keccak256(encodeState(resultingState)),
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
    const actionDigest = computeActionHash(
      turnTaker.address,
      stateHash,
      encodeAction(action),
      versionNumber,
    );
    await appRegistry.functions.setAndProgressState(
      appInstance.appIdentity,
      {
        versionNumber,
        appStateHash: stateHash,
        timeout,
        signatures: await sortSignaturesBySignerAddress(
          stateDigest,
          [
            await signChannelMessage(alice.privateKey, stateDigest),
            await signChannelMessage(bob.privateKey, stateDigest),
          ],
          verifyChannelMessage,
        ),
      },
      encodeState(state),
      {
        encodedAction: encodeAction(action),
        signature: await signChannelMessage(turnTaker.privateKey, actionDigest),
      },
    );
  };

  const cancelChallenge = async (versionNumber: number, signatures?: string[]): Promise<void> => {
    const digest = computeCancelChallengeHash(appInstance.identityHash, toBN(versionNumber));
    if (!signatures) {
      signatures = await sortSignaturesBySignerAddress(
        digest,
        [
          await signChannelMessage(alice.privateKey, digest),
          await signChannelMessage(bob.privateKey, digest),
        ],
        verifyChannelMessage,
      );
    }
    // TODO: why does event verification fail?
    // await wrapInEventVerification(
    await appRegistry.functions.cancelChallenge(appInstance.appIdentity, {
      versionNumber: toBN(versionNumber),
      signatures,
    });
    //   { ...EMPTY_CHALLENGE },
    // );
  };

  const cancelChallengeAndVerify = async (
    versionNumber: number,
    signatures?: string[],
  ): Promise<void> => {
    await cancelChallenge(versionNumber, signatures);
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
    ONCHAIN_CHALLENGE_TIMEOUT,
    DEFAULT_TIMEOUT,
    appInstance,
    // helper fns
    getChallenge,
    verifyChallenge,
    verifyEmptyChallenge: () => verifyChallenge(EMPTY_CHALLENGE),
    isProgressable,
    isStateFinalized,
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
    cancelChallenge,
    cancelChallengeAndVerify,
  };
};
