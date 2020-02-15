import { waffle as buidler } from "@nomiclabs/buidler";
import { Wallet, Contract } from "ethers";
import {
  AppIdentityTestClass,
  Challenge,
  deployRegistry,
  expect,
  deployApp,
  latestVersionNumber,
  encodeAppState,
  getAppWithActionState,
  ONCHAIN_CHALLENGE_TIMEOUT,
  setStateWithSignatures,
  getChallenge,
  ChallengeStatus,
  setOutcome,
  getOutcome,
  isOutcomeSet,
  getExpectedOutcome,
} from "../utils";
import { BigNumberish, keccak256, bigNumberify } from "ethers/utils";
import { Zero, One } from "ethers/constants";

/* global before */

const alice =
  // 0xaeF082d339D227646DB914f0cA9fF02c8544F30b
  new Wallet("0x3570f77380e22f8dc2274d8fd33e7830cc2d29cf76804e8c21f4f7a6cc571d27");

const bob =
  // 0xb37e49bFC97A948617bF3B63BC6942BB15285715
  new Wallet("0x4ccac8b1e81fb18a98bbaf29b9bfe307885561f71b76bd4680d7aec9d0ddfcfd");

describe("MixinSetOutcome.sol", () => {
  const provider = buidler.provider;
  const intialStateHash = encodeAppState(getAppWithActionState());
  let wallet: Wallet;
  let challengeRegistry: Contract;
  let appWithAction: Contract;
  let appWithActionComputeFails: Contract;

  let globalChannelNonce = 0;
  let appIdentityTestObject: AppIdentityTestClass;
  let setChallenge: (appState?: string, timeout?: BigNumberish) => Promise<Challenge>;

  before(async () => {
    // deploy contract, set provider/wallet
    wallet = (await provider.getWallets())[0];

    challengeRegistry = await deployRegistry(wallet);

    appWithAction = await deployApp(wallet);
    appWithActionComputeFails = await deployApp(wallet, { computeOutcomeFails: true });
  });

  beforeEach(async () => {
    // create new appidentity
    appIdentityTestObject = new AppIdentityTestClass(
      [alice.address, bob.address], // participants
      appWithAction.address, // app def
      10, // default timeout
      globalChannelNonce,
    );

    globalChannelNonce += 1;

    const versionNumber = await latestVersionNumber(
      appIdentityTestObject.identityHash,
      challengeRegistry,
    );
    expect(versionNumber).to.be.equal(Zero);

    // sets the state and begins a challenge
    setChallenge = async (
      appState: string = intialStateHash,
      timeout: BigNumberish = ONCHAIN_CHALLENGE_TIMEOUT,
    ): Promise<Challenge> => {
      await setStateWithSignatures(
        appIdentityTestObject,
        [alice, bob],
        challengeRegistry,
        versionNumber.add(1),
        appState,
        timeout,
      );

      // make sure the challenge is correct
      const challenge = await getChallenge(appIdentityTestObject.identityHash, challengeRegistry);
      expect(challenge).to.containSubset({
        appStateHash: keccak256(appState),
        challengeCounter: One,
        finalizesAt: bigNumberify(timeout).add(await provider.getBlockNumber()),
        latestSubmitter: wallet.address,
        status: bigNumberify(timeout).isZero()
          ? ChallengeStatus.EXPLICITLY_FINALIZED
          : ChallengeStatus.FINALIZES_AFTER_DEADLINE,
        versionNumber: One,
      });
      return challenge;
    };
  });

  it("should fail if the challenge is not finalized based on timing", async () => {
    await setChallenge();
    await expect(
      setOutcome(appIdentityTestObject, challengeRegistry, intialStateHash),
    ).to.be.revertedWith("setOutcome can only be called after a challenge has been finalized");
  });

  it("should fail if the challenge status is not EXPLICITLY_FINALIZED", async () => {
    await setChallenge(undefined, 0);
    await setOutcome(appIdentityTestObject, challengeRegistry);
    const challenge = await getChallenge(appIdentityTestObject.identityHash, challengeRegistry);
    expect(challenge.status).to.be.equal(ChallengeStatus.OUTCOME_SET);
    await expect(
      setOutcome(appIdentityTestObject, challengeRegistry, intialStateHash),
    ).to.be.revertedWith("setOutcome can only be called after a challenge has been finalized");
  });

  it("should fail if the submitted state does not have the correct state hash", async () => {
    await setChallenge(undefined, 0);
    const falseState = encodeAppState(getAppWithActionState(2));
    await expect(
      setOutcome(appIdentityTestObject, challengeRegistry, falseState),
    ).to.be.revertedWith("setOutcome called with incorrect witness data of finalState");
  });

  it("should fail if `computeOutcome` fails", async () => {
    appIdentityTestObject = new AppIdentityTestClass(
      [alice.address, bob.address], // participants
      appWithActionComputeFails.address, // app def
      10, // default timeout
      globalChannelNonce,
    );
    globalChannelNonce += 1;
    await setChallenge(undefined, 0);
    await expect(
      setOutcome(appIdentityTestObject, challengeRegistry, intialStateHash),
    ).to.be.revertedWith("computeOutcome fails");
  });

  it("should be able to successfully set the outcome of a challenge", async () => {
    await setChallenge(undefined, 0);
    await setOutcome(appIdentityTestObject, challengeRegistry, intialStateHash);
    expect(await isOutcomeSet(appIdentityTestObject.identityHash, challengeRegistry)).to.be.true;
    const outcome = await getOutcome(appIdentityTestObject.identityHash, challengeRegistry);
    expect(outcome).to.be.equal(getExpectedOutcome());
  });
});
