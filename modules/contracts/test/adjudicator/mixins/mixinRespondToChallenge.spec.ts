/* global before */
import { waffle as buidler } from "@nomiclabs/buidler";
import { Wallet, Contract } from "ethers";
import {
  deployRegistry,
  expect,
  setStateWithSignatures,
  ONCHAIN_CHALLENGE_TIMEOUT,
  Challenge,
  AppIdentityTestClass,
  deployApp,
  latestVersionNumber,
  getChallenge,
  ChallengeStatus,
  AppWithActionAction,
  AppWithActionState,
  encodeAppState,
  encodeAppAction,
  signaturesToBytes,
  getAppWithActionState,
  getIncrementCounterAction,
} from "../utils";
import { BigNumberish, keccak256, bigNumberify, SigningKey } from "ethers/utils";
import { HashZero, Zero, One } from "ethers/constants";

const alice =
  // 0xaeF082d339D227646DB914f0cA9fF02c8544F30b
  new Wallet("0x3570f77380e22f8dc2274d8fd33e7830cc2d29cf76804e8c21f4f7a6cc571d27");

const bob =
  // 0xb37e49bFC97A948617bF3B63BC6942BB15285715
  new Wallet("0x4ccac8b1e81fb18a98bbaf29b9bfe307885561f71b76bd4680d7aec9d0ddfcfd");

describe("MixinRespondToChallenge.sol", () => {
  const provider = buidler.provider;
  let wallet: Wallet;
  let challengeRegistry: Contract;
  let appWithAction: Contract;
  let appIdentityTestObject: AppIdentityTestClass;

  let globalChannelNonce = 0;
  let setChallenge: (appState?: string, timeout?: BigNumberish) => Promise<Challenge>;
  let respond: (
    state?: AppWithActionState,
    action?: AppWithActionAction,
    signer?: Wallet,
  ) => Promise<void>;

  before(async () => {
    // deploy contract, set provider/wallet
    wallet = (await provider.getWallets())[0];

    challengeRegistry = await deployRegistry(wallet);
  });

  beforeEach(async () => {
    appWithAction = await deployApp(wallet);
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

    respond = async (
      state: AppWithActionState = getAppWithActionState(),
      action: AppWithActionAction = getIncrementCounterAction(),
      signer: Wallet = bob,
    ): Promise<void> => {
      const hashedAndEncodedAction = keccak256(encodeAppAction(action));
      const signingKey = new SigningKey(signer.privateKey);
      const signature = await signingKey.signDigest(hashedAndEncodedAction);
      const bytes = signaturesToBytes(signature);
      return await challengeRegistry.functions.respondToChallenge(
        appIdentityTestObject.appIdentity,
        encodeAppState(state),
        encodeAppAction(action),
        bytes,
      );
    };
  });

  it("should fail if the challenge is finalized", async () => {
    const challenge = await setChallenge(undefined, 0);
    expect(challenge.status).to.be.equal(ChallengeStatus.EXPLICITLY_FINALIZED);
    await expect(respond()).to.be.revertedWith(
      "respondToChallenge called on app not in FINALIZES_AFTER_DEADLINE",
    );
  });

  it("should fail if the app state hash is not the same as the challenge app state hash", async () => {
    await setChallenge();
    await expect(respond(getAppWithActionState(2))).to.be.revertedWith(
      "Tried to progress a challenge with non-agreed upon app",
    );
  });

  it("should fail if it cannot get a turn taker", async () => {
    appWithAction = await deployApp(wallet, { getTurnTakerFails: true });
    appIdentityTestObject = new AppIdentityTestClass(
      [alice.address, bob.address], // participants
      appWithAction.address, // app def
      10, // default timeout
      globalChannelNonce,
    );
    globalChannelNonce += 1;
    await setChallenge();
    await expect(respond()).to.be.revertedWith(
      "The getTurnTaker method has no implementation for this App",
    );
  });

  it("should fail if the action is not signed by the turn taker", async () => {
    await setChallenge();
    await expect(respond(undefined, undefined, alice)).to.be.revertedWith(
      "Action must have been signed by correct turn taker",
    );
  });

  it("should fail if applyAction fails", async () => {
    appWithAction = await deployApp(wallet, { applyActionFails: true });
    appIdentityTestObject = new AppIdentityTestClass(
      [alice.address, bob.address], // participants
      appWithAction.address, // app def
      10, // default timeout
      globalChannelNonce,
    );
    globalChannelNonce += 1;
    await setChallenge();
    await expect(respond()).to.be.revertedWith(
      "The applyAction method has no implementation for this App",
    );
  });

  it.skip("should be able to respond to a challenge", async () => {
    const initialChallenge = await setChallenge();
    expect(initialChallenge.challengeCounter).to.be.eq(One);
    await respond();
    const respondedChallenge = await getChallenge(
      appIdentityTestObject.identityHash,
      challengeRegistry,
    );
    // TODO: will be an empty challenge, is this expected? is this a problem?
    expect(respondedChallenge).to.be.equal(undefined);
  });

  // TODO: is this test correct? need to circle up with liam to verify the
  // intended use of `respondToChallenge`
  it.skip("should be able to call setOutcome after a challenge response", async () => {});
});
