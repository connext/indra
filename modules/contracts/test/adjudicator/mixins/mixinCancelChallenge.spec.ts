/* global before */
import { waffle as buidler } from "@nomiclabs/buidler";
import { Wallet, Contract } from "ethers";

import {
  expect,
  AppIdentityTestClass,
  Challenge,
  latestVersionNumber,
  setStateWithSignatures,
  getChallenge,
  ChallengeStatus,
  cancelChallenge,
  advanceBlocks,
  deployRegistry,
  ONCHAIN_CHALLENGE_TIMEOUT,
} from "../utils";
import { hexlify, randomBytes, keccak256, bigNumberify, BigNumberish } from "ethers/utils";
import { HashZero, Zero, One } from "ethers/constants";

const alice =
  // 0xaeF082d339D227646DB914f0cA9fF02c8544F30b
  new Wallet("0x3570f77380e22f8dc2274d8fd33e7830cc2d29cf76804e8c21f4f7a6cc571d27");

const bob =
  // 0xb37e49bFC97A948617bF3B63BC6942BB15285715
  new Wallet("0x4ccac8b1e81fb18a98bbaf29b9bfe307885561f71b76bd4680d7aec9d0ddfcfd");

describe("MixinCancelChallenge.sol", () => {
  let provider = buidler.provider;
  let wallet: Wallet;
  let globalChannelNonce = 0;

  let challengeRegistry: Contract;
  let appIdentityTestObject: AppIdentityTestClass;
  let setChallenge: (appState?: string, timeout?: BigNumberish) => Promise<Challenge>;
  let cancel: () => Promise<Challenge>;

  before(async () => {
    // deploy contract, set provider/wallet
    wallet = (await provider.getWallets())[0];

    challengeRegistry = await deployRegistry(wallet);
  });

  beforeEach(async () => {
    // create new appidentity
    appIdentityTestObject = new AppIdentityTestClass(
      [alice.address, bob.address], // participants
      hexlify(randomBytes(20)), // app def
      10, // default timeout
      globalChannelNonce,
    );

    globalChannelNonce += 1;

    const versionNumber = await latestVersionNumber(appIdentityTestObject.identityHash, challengeRegistry);
    expect(versionNumber).to.be.equal(Zero);

    // sets the state and begins a challenge
    setChallenge = async (
      appState: string = HashZero,
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

    cancel = async (): Promise<Challenge> => {
      await cancelChallenge([alice, bob], appIdentityTestObject, challengeRegistry);
      // verify the challenge
      const challenge = await getChallenge(appIdentityTestObject.identityHash, challengeRegistry);
      expect(challenge).to.containSubset({
        finalizesAt: Zero,
        latestSubmitter: wallet.address,
        status: ChallengeStatus.NO_CHALLENGE,
      });
      return challenge;
    };
  });

  it("fails if challenge is finalized -- too much time has passed", async () => {
    await setChallenge();
    // mine blocks
    await advanceBlocks(provider);
    await expect(cancel()).to.be.revertedWith(`cancelChallenge called on app not in FINALIZES_AFTER_DEADLINE state`);
  });

  it("fails if challenge is finalized -- wrong status", async () => {
    await setChallenge(undefined, Zero);
    await expect(cancel()).to.be.revertedWith(`cancelChallenge called on app not in FINALIZES_AFTER_DEADLINE state`);
  });

  it("can cancel an active challenge", async () => {
    await setChallenge();
    await cancel();
  });
});
