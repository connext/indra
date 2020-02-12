/* global before */
import { waffle as buidler } from "@nomiclabs/buidler";
import {
  expect,
  Challenge,
  deployRegistry,
  AppIdentityTestClass,
  deployApp,
  latestVersionNumber,
  encodeAppState,
  getAppWithActionState,
  ONCHAIN_CHALLENGE_TIMEOUT,
  setStateWithSignatures,
  getChallenge,
  ChallengeStatus,
  setOutcome,
  isStateFinalized,
  computeAppChallengeHash,
  sortSignaturesBySignerAddress,
} from "../utils";
import { Wallet, Contract } from "ethers";
import { Zero, One } from "ethers/constants";
import { BigNumberish, keccak256, bigNumberify, SigningKey, joinSignature, hexlify, randomBytes } from "ethers/utils";

const alice =
  // 0xaeF082d339D227646DB914f0cA9fF02c8544F30b
  new Wallet("0x3570f77380e22f8dc2274d8fd33e7830cc2d29cf76804e8c21f4f7a6cc571d27");

const bob =
  // 0xb37e49bFC97A948617bF3B63BC6942BB15285715
  new Wallet("0x4ccac8b1e81fb18a98bbaf29b9bfe307885561f71b76bd4680d7aec9d0ddfcfd");

describe.only("MixinSetState.sol", () => {
  const provider = buidler.provider;
  const intialStateHash = encodeAppState(getAppWithActionState());
  let wallet: Wallet;
  let globalChannelNonce = 0;

  let appWithAction: Contract;
  let challengeRegistry: Contract;
  let appIdentityTestObject: AppIdentityTestClass;
  let setChallenge: (appState?: string, timeout?: BigNumberish, versionNo?: BigNumberish) => Promise<Challenge>;

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
      10, // default timeout
      globalChannelNonce,
    );

    globalChannelNonce += 1;

    const versionNumber = await latestVersionNumber(appIdentityTestObject.identityHash, challengeRegistry);
    expect(versionNumber).to.be.equal(Zero);

    // sets the state and begins a challenge
    setChallenge = async (
      appState: string = intialStateHash,
      timeout: BigNumberish = ONCHAIN_CHALLENGE_TIMEOUT,
      versionNo: BigNumberish = versionNumber.add(1),
    ): Promise<Challenge> => {
      await setStateWithSignatures(
        appIdentityTestObject,
        [alice, bob],
        challengeRegistry,
        versionNo,
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

  it("should fail if the challenge is finalized", async () => {
    await setChallenge(undefined, 0);
    // second try should fail
    expect(await isStateFinalized(appIdentityTestObject.identityHash, challengeRegistry)).to.be.true;
    await expect(setChallenge()).revertedWith("setState was called on an app that has already been finalized");
  });

  it("should fail if the status is NO_CHALLENGE", async () => {
    await setChallenge(undefined, 0);
    await setOutcome(appIdentityTestObject, challengeRegistry);
    const challenge = await getChallenge(appIdentityTestObject.identityHash, challengeRegistry);
    expect(challenge.status).to.be.equal(ChallengeStatus.OUTCOME_SET);
    await expect(setChallenge()).revertedWith("setState was called on an app that has already been finalized");
  });

  it("should fail if the signatures are incorrect", async () => {
    const stateHash = keccak256(intialStateHash);
    const versionNumber = await latestVersionNumber(appIdentityTestObject.identityHash, challengeRegistry);
    const submittedVersionNo = versionNumber.add(1);
    const timeout = Zero;
    const digest = computeAppChallengeHash(appIdentityTestObject.identityHash, stateHash, submittedVersionNo, timeout);
    await expect(
      challengeRegistry.functions.setState(appIdentityTestObject.appIdentity, {
        appStateHash: keccak256(encodeAppState(getAppWithActionState(5))),
        signatures: sortSignaturesBySignerAddress(digest, [
          await new SigningKey(alice.privateKey).signDigest(digest),
          await new SigningKey(bob.privateKey).signDigest(digest),
        ]).map(joinSignature),
        timeout,
        versionNumber: submittedVersionNo,
      }),
    ).to.be.revertedWith("Invalid signature");
  });

  it("should fail if the version number is stale", async () => {
    await setChallenge();
    await expect(setChallenge(undefined, undefined, Zero)).to.be.revertedWith(
      "Tried to call setState with an outdated versionNumber version",
    );
  });

  it("should fail if the timeout < finalizesAt", async () => {
    try {
      await setChallenge(undefined, 1e24);
    } catch (e) {
      expect(e.message.includes("underflow")).to.be.true;
    }
  });

  it("should correctly set the challenge state with nonzero timeout", async () => {
    await setChallenge();
  });

  it("should correctly set the challenge state with zero timeout", async () => {
    await setChallenge(undefined, 0);
  });
});
