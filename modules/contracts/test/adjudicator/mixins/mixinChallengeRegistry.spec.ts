/* global before */
import { waffle as buidler } from "@nomiclabs/buidler";
import { Wallet, Contract } from "ethers";

import {
  deployRegistry,
  expect,
  AppIdentityTestClass,
  latestVersionNumber,
  setStateWithSignatures,
  getChallenge,
  getOutcome,
  ChallengeStatus,
  ONCHAIN_CHALLENGE_TIMEOUT,
  advanceBlocks,
  isOutcomeSet,
  isStateFinalized,
  setOutcome,
  deployApp,
} from "../utils";
import { BigNumberish, keccak256, bigNumberify } from "ethers/utils";
import { Zero, HashZero, One } from "ethers/constants";

const alice =
  // 0xaeF082d339D227646DB914f0cA9fF02c8544F30b
  new Wallet("0x3570f77380e22f8dc2274d8fd33e7830cc2d29cf76804e8c21f4f7a6cc571d27");

const bob =
  // 0xb37e49bFC97A948617bF3B63BC6942BB15285715
  new Wallet("0x4ccac8b1e81fb18a98bbaf29b9bfe307885561f71b76bd4680d7aec9d0ddfcfd");

describe("MixinChallengeRegistry.sol", () => {
  let provider = buidler.provider;
  let wallet: Wallet;
  let challengeRegistry: Contract;
  let appWithAction: Contract;
  let appIdentityTestObject: AppIdentityTestClass;

  const appState = HashZero;
  const timeout = ONCHAIN_CHALLENGE_TIMEOUT;

  let globalChannelNonce = 0;
  let setChallenge: (appState?: string, timeout?: BigNumberish) => Promise<void>;

  before(async () => {
    // deploy contract, set provider/wallet
    wallet = (await provider.getWallets())[0];

    challengeRegistry = await deployRegistry(wallet);
    appWithAction = await deployApp(wallet);
  });

  beforeEach(async () => {
    // create new appidentity
    appIdentityTestObject = new AppIdentityTestClass(
      [alice.address, bob.address], // participants
      appWithAction.address, // app def
      ONCHAIN_CHALLENGE_TIMEOUT, // default timeout
      globalChannelNonce, // channel nonce
    );

    globalChannelNonce += 1;

    const versionNumber = await latestVersionNumber(
      appIdentityTestObject.identityHash,
      challengeRegistry,
    );
    expect(versionNumber).to.be.equal(Zero);

    // sets the state and begins a challenge
    setChallenge = async (
      appState: string = HashZero,
      timeout: BigNumberish = ONCHAIN_CHALLENGE_TIMEOUT,
    ): Promise<void> => {
      await setStateWithSignatures(
        appIdentityTestObject,
        [alice, bob],
        challengeRegistry,
        versionNumber.add(1),
        appState,
        timeout,
      );
    };
  });

  it("can correctly retrieve a challenge from an identity hash", async () => {
    // make sure the challenge is correct
    await setChallenge();
    const challenge = await getChallenge(appIdentityTestObject.identityHash, challengeRegistry);
    expect(challenge).to.containSubset({
      appStateHash: keccak256(appState),
      challengeCounter: One,
      finalizesAt: bigNumberify(timeout).add(await provider.getBlockNumber()),
      latestSubmitter: wallet.address,
      status: bigNumberify(ONCHAIN_CHALLENGE_TIMEOUT).isZero()
        ? ChallengeStatus.EXPLICITLY_FINALIZED
        : ChallengeStatus.FINALIZES_AFTER_DEADLINE,
      versionNumber: One,
    });
  });

  it("can correctly determine if a state is finalized based on timing", async () => {
    // advance blocks
    await setChallenge();
    await advanceBlocks(provider);
    const isFinalized = await isStateFinalized(
      appIdentityTestObject.identityHash,
      challengeRegistry,
    );
    expect(isFinalized).to.be.true;
  });

  it("can correctly determine if a state is finalized based on status", async () => {
    await setChallenge(undefined, 0);
    const isFinalized = await isStateFinalized(
      appIdentityTestObject.identityHash,
      challengeRegistry,
    );
    expect(isFinalized).to.be.true;
  });

  it("can correctly determine if a an outcome is set", async () => {
    await setChallenge();
    const outcomeSet = await isOutcomeSet(appIdentityTestObject.identityHash, challengeRegistry);
    expect(outcomeSet).to.be.false;
  });

  it("can correctly return an outcome", async () => {
    await setChallenge();
    await advanceBlocks(provider);
    await setOutcome(appIdentityTestObject, challengeRegistry);
    expect(await isOutcomeSet(appIdentityTestObject.identityHash, challengeRegistry)).to.be.true;
    const outcome = await getOutcome(appIdentityTestObject.identityHash, challengeRegistry);
    expect(outcome).to.be.equal(HashZero);
  });

  it("fails to return an outcome if the status is incorrect", async () => {
    await setChallenge();
    const outcomeSet = await isOutcomeSet(appIdentityTestObject.identityHash, challengeRegistry);
    expect(outcomeSet).to.be.false;
    await expect(
      getOutcome(appIdentityTestObject.identityHash, challengeRegistry),
    ).to.be.revertedWith("Outcome must be set");
  });
});
