/* global before */
import { waffle as buidler } from "@nomiclabs/buidler";
import { Contract, Wallet } from "ethers";
import { HashZero } from "ethers/constants";
import {
  bigNumberify
  BigNumberish,
  hexlify,
  joinSignature,
  keccak256,
  randomBytes,
  SigningKey,
} from "ethers/utils";

import ChallengeRegistry from "../../build/ChallengeRegistry.json";

import {
  advanceBlocks,
  AppIdentityTestClass,
  cancelChallenge,
  Challenge,
  ChallengeStatus,
  deployApp,
  deployRegistry,
  encodeAppAction,
  encodeAppState,
  expect,
  getAppWithActionState,
  getChallenge,
  getIncrementCounterAction,
  getOutcome,
  isStateFinalized,
  latestAppStateHash,
  latestVersionNumber,
  setOutcome,
  setStateWithSignatures,
  setStateWithSignedAction,
  sortSignaturesBySignerAddress,
} from "./utils";
import { Zero } from "ethers/constants";

const ALICE =
  // 0xaeF082d339D227646DB914f0cA9fF02c8544F30b
  new Wallet("0x3570f77380e22f8dc2274d8fd33e7830cc2d29cf76804e8c21f4f7a6cc571d27");

const BOB =
  // 0xb37e49bFC97A948617bF3B63BC6942BB15285715
  new Wallet("0x4ccac8b1e81fb18a98bbaf29b9bfe307885561f71b76bd4680d7aec9d0ddfcfd");

// HELPER DATA
const ONCHAIN_CHALLENGE_TIMEOUT = 30;

describe("ChallengeRegistry", () => {
  const provider = buidler.provider;
  let wallet: Wallet;
  let globalChannelNonce = 0;

  let challengeRegistry: Contract;
  let appWithAction: Contract;
  let appIdentityTestObject: AppIdentityTestClass;

  let sendSignedFinalizationToChain: () => Promise<any>;
  let setStateWithSigs: (
    versionNumber: BigNumberish,
    appState?: string,
    timeout?: number,
  ) => Promise<Challenge>;
  let cancel: () => Promise<void>;
  let outcome: (finalState?: string) => Promise<void>;
  let setStateWithAction: (
    versionNo: BigNumberish,
    action?: string,
    appState?: string,
    turnTaker?: Wallet,
    timeout?: BigNumberish,
    appIdentity?: AppIdentityTestClass,
  ) => Promise<Challenge>;
  let getFinalState: (previousState?: string, action?: string) => Promise<string>;

  before(async () => {
    wallet = (await provider.getWallets())[0];

    challengeRegistry = await deployRegistry(wallet);
    appWithAction = await deployApp(wallet);
  });

  beforeEach(async () => {
    appIdentityTestObject = new AppIdentityTestClass(
      [ALICE.address, BOB.address],
      appWithAction.address,
      10,
      globalChannelNonce,
    );

    globalChannelNonce += 1;

    setStateWithSigs = async (
      versionNumber: BigNumberish,
      appState: string = encodeAppState(getAppWithActionState()),
      timeout: number = ONCHAIN_CHALLENGE_TIMEOUT,
    ): Promise<Challenge> => {
      await setStateWithSignatures(
        appIdentityTestObject,
        [ALICE, BOB],
        challengeRegistry,
        versionNumber,
        appState,
        timeout,
      );
      // make sure the challenge is correct
      const challenge = await getChallenge(appIdentityTestObject.identityHash, challengeRegistry);
      expect(challenge).to.containSubset({
        appStateHash: keccak256(appState),
        finalizesAt: bigNumberify(timeout).add(await provider.getBlockNumber()),
        latestSubmitter: wallet.address,
        status: bigNumberify(timeout).isZero()
          ? ChallengeStatus.EXPLICITLY_FINALIZED
          : ChallengeStatus.FINALIZES_AFTER_DEADLINE,
        versionNumber: bigNumberify(versionNumber),
      });
      return challenge;
    };

    setStateWithAction = async (
      versionNo: BigNumberish,
      action: string = encodeAppAction(getIncrementCounterAction()),
      appState: string = encodeAppState(getAppWithActionState()),
      turnTaker: Wallet = BOB,
      timeout: BigNumberish = ONCHAIN_CHALLENGE_TIMEOUT,
      appIdentity: AppIdentityTestClass = appIdentityTestObject,
    ): Promise<Challenge> => {
      await setStateWithSignedAction(
        appIdentity,
        [ALICE, BOB],
        turnTaker,
        challengeRegistry,
        versionNo,
        action,
        appState,
        timeout,
      );

      const newState = await appWithAction.functions.applyAction(appState, action);

      // make sure the challenge is correct
      const challenge = await getChallenge(appIdentity.identityHash, challengeRegistry);
      expect(challenge).to.containSubset({
        appStateHash: keccak256(newState),
        finalizesAt: bigNumberify(appIdentity.defaultTimeout).add(await provider.getBlockNumber()),
        latestSubmitter: wallet.address,
        status: bigNumberify(timeout).isZero()
          ? ChallengeStatus.EXPLICITLY_FINALIZED
          : ChallengeStatus.FINALIZES_AFTER_DEADLINE,
        versionNumber: bigNumberify(versionNo),
      });
      return challenge;
    };

    sendSignedFinalizationToChain = async () => {
      const stateHash = await latestAppStateHash(
        appIdentityTestObject.identityHash,
        challengeRegistry,
      );
      const submittedVersionNo = (
        await latestVersionNumber(appIdentityTestObject.identityHash, challengeRegistry)
      ).add(1);
      await setStateWithSigs(submittedVersionNo, stateHash, 0);
      // make sure the challenge is correct
      const challenge = await getChallenge(appIdentityTestObject.identityHash, challengeRegistry);
      expect(challenge).to.containSubset({
        appStateHash: keccak256(stateHash),
        finalizesAt: bigNumberify(await provider.getBlockNumber()),
        latestSubmitter: wallet.address,
        status: ChallengeStatus.EXPLICITLY_FINALIZED,
        versionNumber: submittedVersionNo,
      });
      return challenge;
    };

    cancel = async (): Promise<void> => {
      await cancelChallenge([ALICE, BOB], appIdentityTestObject, challengeRegistry);
      const challenge = await getChallenge(appIdentityTestObject.identityHash, challengeRegistry);
      expect(challenge).to.containSubset({
        appStateHash: await latestAppStateHash(
          appIdentityTestObject.identityHash,
          challengeRegistry,
        ),
        finalizesAt: Zero,
        latestSubmitter: wallet.address,
        status: ChallengeStatus.NO_CHALLENGE,
        versionNumber: await latestVersionNumber(
          appIdentityTestObject.identityHash,
          challengeRegistry,
        ),
      });
    };

    outcome = async (
      finalState: string = encodeAppState(getAppWithActionState()),
    ): Promise<void> => {
      await setOutcome(appIdentityTestObject, challengeRegistry, finalState);
      const challenge = await getChallenge(appIdentityTestObject.identityHash, challengeRegistry);
      expect(challenge).to.containSubset({
        status: ChallengeStatus.OUTCOME_SET,
      });
      const outcome = await getOutcome(appIdentityTestObject.identityHash, challengeRegistry);
      const expected = await appWithAction.functions.computeOutcome(hexlify(randomBytes(32)));
      expect(outcome).to.be.equal(expected);
    };

    getFinalState = async (
      previousState: string = encodeAppState(getAppWithActionState()),
      action: string = encodeAppAction(getIncrementCounterAction()),
    ): Promise<string> => {
      return await appWithAction.functions.applyAction(previousState, action);
    };
  });

  describe("updating app state", () => {
    describe("with signing keys and setState", async () => {
      it("should work with higher versionNumber", async () => {
        expect(
          await latestVersionNumber(appIdentityTestObject.identityHash, challengeRegistry),
        ).to.eq(0);
        const challenge = await setStateWithSigs(1);
        expect(
          await latestVersionNumber(appIdentityTestObject.identityHash, challengeRegistry),
        ).to.eq(1);
        await advanceBlocks(provider, challenge.finalizesAt);
        await outcome();
      });

      it("should work many times", async () => {
        expect(
          await latestVersionNumber(appIdentityTestObject.identityHash, challengeRegistry),
        ).to.eq(0);
        await setStateWithSigs(1);
        expect(
          await latestVersionNumber(appIdentityTestObject.identityHash, challengeRegistry),
        ).to.eq(1);
        await cancel();
        await setStateWithSigs(2);
        expect(
          await latestVersionNumber(appIdentityTestObject.identityHash, challengeRegistry),
        ).to.eq(2);
        await cancel();
        const challenge = await setStateWithSigs(3);
        expect(
          await latestVersionNumber(appIdentityTestObject.identityHash, challengeRegistry),
        ).to.eq(3);
        await advanceBlocks(provider, challenge.finalizesAt);
        await outcome();
      });

      it("should work many times without cancelling challenges", async () => {
        expect(
          await latestVersionNumber(appIdentityTestObject.identityHash, challengeRegistry),
        ).to.eq(0);
        await setStateWithSigs(1);
        expect(
          await latestVersionNumber(appIdentityTestObject.identityHash, challengeRegistry),
        ).to.eq(1);
        await setStateWithSigs(2);
        expect(
          await latestVersionNumber(appIdentityTestObject.identityHash, challengeRegistry),
        ).to.eq(2);
        const challenge = await setStateWithSigs(3);
        expect(
          await latestVersionNumber(appIdentityTestObject.identityHash, challengeRegistry),
        ).to.eq(3);
        await advanceBlocks(provider, challenge.finalizesAt);
        await outcome();
      });

      it("should work with much higher versionNumber", async () => {
        expect(
          await latestVersionNumber(appIdentityTestObject.identityHash, challengeRegistry),
        ).to.eq(0);
        const challenge = await setStateWithSigs(1000);
        expect(
          await latestVersionNumber(appIdentityTestObject.identityHash, challengeRegistry),
        ).to.eq(1000);
        await advanceBlocks(provider, challenge.finalizesAt);
        await outcome();
      });

      it("shouldn't work with an equal versionNumber", async () => {
        await expect(setStateWithSigs(0)).to.be.reverted;
        expect(
          await latestVersionNumber(appIdentityTestObject.identityHash, challengeRegistry),
        ).to.eq(0);
      });

      it("shouldn't work with a lower versionNumber", async () => {
        await setStateWithSigs(1);
        await expect(setStateWithSigs(0)).to.be.reverted;
        expect(
          await latestVersionNumber(appIdentityTestObject.identityHash, challengeRegistry),
        ).to.eq(1);
      });

      it("should successfully cancel a challenge", async () => {
        await setStateWithSigs(1);
        await cancel();
        await expect(outcome()).to.be.revertedWith(
          "setOutcome can only be called after a challenge has been finalized",
        );
      });

      it("should be able to respond to challenge with a valid action", async () => {
        await setStateWithSigs(1);
        const challenge = await setStateWithAction(2);
        await advanceBlocks(provider, challenge.finalizesAt);
        const finalState = await getFinalState();
        await outcome(finalState);
      });
    });

    describe("with signing keys and setStateWithAction", async () => {
      it("should work many times", async () => {
        await setStateWithAction(1);
        await cancel();
        await setStateWithAction(2);
        await cancel();
        const challenge = await setStateWithAction(3);
        await advanceBlocks(provider, challenge.finalizesAt);
        const finalState = await getFinalState();
        await outcome(finalState);
      });

      it("should work many times without cancelling", async () => {
        await setStateWithAction(1);
        await setStateWithAction(2);
        const challenge = await setStateWithAction(3);
        await advanceBlocks(provider, challenge.finalizesAt);
        const finalState = await getFinalState();
        await outcome(finalState);
      });

      it("should work with much higher version number", async () => {
        await setStateWithAction(1);
        const challenge = await setStateWithAction(200);
        await advanceBlocks(provider, challenge.finalizesAt);
        const finalState = await getFinalState();
        await outcome(finalState);
      });

      it("should fail with an equal version number", async () => {
        await setStateWithAction(1);
        await expect(setStateWithAction(1)).to.be.revertedWith(
          `setStateWithAction was called with outdated state`,
        );
      });

      it("should fail with a lower version number", async () => {
        await setStateWithAction(3);
        await expect(setStateWithAction(1)).to.be.revertedWith(
          `setStateWithAction was called with outdated state`,
        );
      });

      it("should be able to respond with a valid higher state using `setState`", async () => {
        await setStateWithAction(1);
        const updatedState = await getFinalState();
        const challenge = await setStateWithSigs(2, updatedState);
        await advanceBlocks(provider, challenge.finalizesAt);
        await outcome(updatedState);
      });
    });
  });

  describe("finalizing app state", async () => {
    it("should work with keys", async () => {
      expect(await isStateFinalized(appIdentityTestObject.identityHash, challengeRegistry)).to.be
        .false;
      await sendSignedFinalizationToChain();
      expect(await isStateFinalized(appIdentityTestObject.identityHash, challengeRegistry)).to.be
        .true;
    });
  });

  describe("waiting for timeout", async () => {
    it("should block updates after the timeout", async () => {
      expect(await isStateFinalized(appIdentityTestObject.identityHash, challengeRegistry)).to.be
        .false;

      await setStateWithSigs(1);

      await advanceBlocks(provider);

      expect(await isStateFinalized(appIdentityTestObject.identityHash, challengeRegistry)).to.be
        .true;

      await expect(setStateWithSigs(2)).to.be.reverted;

      await expect(setStateWithSigs(0)).to.be.reverted;
    });
  });

  it("is possible to call setState to put state on-chain", async () => {
    // Tell the ChallengeRegistry to start timer
    const state = hexlify(randomBytes(32));

    await setStateWithSigs(1, state);

    // Verify the correct data was put on-chain
    const {
      status,
      latestSubmitter,
      appStateHash,
      challengeCounter,
      finalizesAt,
      versionNumber,
    } = await getChallenge(appIdentityTestObject.identityHash, challengeRegistry);

    expect(status).to.be.eq(1);
    expect(latestSubmitter).to.be.eq(await wallet.getAddress());
    expect(appStateHash).to.be.eq(keccak256(state));
    expect(challengeCounter).to.be.eq(1);
    expect(finalizesAt).to.be.eq((await provider.getBlockNumber()) + ONCHAIN_CHALLENGE_TIMEOUT);
    expect(versionNumber).to.be.eq(1);
  });
});
