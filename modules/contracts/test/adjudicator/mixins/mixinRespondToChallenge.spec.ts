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
  getAppWithActionState,
  getIncrementCounterAction,
  getStateSignatures,
  getActionSignature,
} from "../utils";
import { BigNumberish, keccak256, bigNumberify } from "ethers/utils";
import { HashZero, Zero, One } from "ethers/constants";
import { AppWithAction } from "../../..";

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
    versionNumber?: BigNumberish,
    timeout?: BigNumberish,
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
      appState: string = encodeAppState(getAppWithActionState()),
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
      versionNumber: BigNumberish = One,
      timeout: BigNumberish = ONCHAIN_CHALLENGE_TIMEOUT,
    ): Promise<void> => {
      const existingChallenge = await getChallenge(
        appIdentityTestObject.identityHash,
        challengeRegistry,
      );
      expect(existingChallenge).to.be.ok;

      const actionSig = await getActionSignature(
        signer,
        keccak256(encodeAppState(state)),
        encodeAppAction(action),
        versionNumber,
      );
      const stateSigs = await getStateSignatures(
        appIdentityTestObject.identityHash,
        [alice, bob],
        encodeAppState(state),
        versionNumber,
        timeout,
      );
      const isApplyingAction = existingChallenge.appStateHash === keccak256(encodeAppState(state));
      await challengeRegistry.functions.respondToChallenge(
        appIdentityTestObject.appIdentity,
        {
          appState: encodeAppState(state),
          versionNumber,
          timeout,
          signatures: stateSigs,
        },
        {
          encodedAction: encodeAppAction(action),
          signature: actionSig,
        },
      );

      // validating updated challenge
      const challenge = await getChallenge(appIdentityTestObject.identityHash, challengeRegistry);
      const app = new Contract(appIdentityTestObject.appDefinition, AppWithAction.abi, wallet);
      const newState = await app.functions.applyAction(
        encodeAppState(state),
        encodeAppAction(action),
      );

      const currBlock = await provider.getBlockNumber();
      expect(challenge).to.containSubset({
        versionNumber: isApplyingAction
          ? bigNumberify(versionNumber).add(1)
          : bigNumberify(versionNumber),
        challengeCounter: existingChallenge.challengeCounter.add(1),
        latestSubmitter: wallet.address,
        status: bigNumberify(timeout).isZero()
          ? ChallengeStatus.EXPLICITLY_FINALIZED
          : ChallengeStatus.FINALIZES_AFTER_DEADLINE,
        appStateHash: isApplyingAction ? keccak256(newState) : keccak256(encodeAppState(state)),
        finalizesAt: isApplyingAction
          ? bigNumberify(appIdentityTestObject.defaultTimeout).add(currBlock)
          : bigNumberify(timeout).add(currBlock),
      });
    };
  });

  it("should fail if the challenge is finalized", async () => {
    const challenge = await setChallenge(undefined, 0);
    expect(challenge.status).to.be.equal(ChallengeStatus.EXPLICITLY_FINALIZED);
    await expect(respond()).to.be.revertedWith(
      "respondToChallenge called on app not in FINALIZES_AFTER_DEADLINE",
    );
  });

  it("should fail if the state is not correctly signed", async () => {
    await setChallenge();
    const versionNumber = await latestVersionNumber(
      appIdentityTestObject.identityHash,
      challengeRegistry,
    );
    const submittedVersionNo = versionNumber.add(1);
    const timeout = Zero;
    const stateSigs = await getStateSignatures(
      appIdentityTestObject.identityHash,
      [alice, bob],
      encodeAppState(getAppWithActionState()),
      submittedVersionNo,
      timeout,
    );
    await expect(
      challengeRegistry.functions.respondToChallenge(
        appIdentityTestObject.appIdentity,
        {
          appState: encodeAppState(getAppWithActionState(5)),
          signatures: stateSigs,
          timeout,
          versionNumber: submittedVersionNo,
        },
        {
          encodedAction: HashZero,
          signature: HashZero,
        },
      ),
    ).to.be.revertedWith("Invalid signature");
  });

  it("should fail if it is called with an outdated state", async () => {
    const challenge = await setChallenge();
    expect(challenge.versionNumber).to.be.equal(One);
    await expect(respond(undefined, undefined, undefined, 0)).to.be.revertedWith(
      "respondToChallenge was called with outdated state",
    );
  });

  describe("Responds to the challenge by taking an action", () => {
    it("should fail if it is called with the same state hash that is already onchain, and the version number is not the same as the challenge version number", async () => {
      await setChallenge();
      await expect(respond(undefined, undefined, undefined, 4)).to.be.revertedWith(
        "respondToChallenge was called with an incorrect state",
      );
    });

    it("should fail if action is not signed by the correct turn taker", async () => {
      await setChallenge();
      await expect(respond(undefined, undefined, alice)).to.be.revertedWith(
        "respondToChallenge called with action signed by incorrect turn taker",
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

    it("should fail if the default timeout on the appIdentity is zero", async () => {
      appIdentityTestObject = new AppIdentityTestClass(
        [alice.address, bob.address], // participants
        appWithAction.address, // app def
        0, // default timeout
        globalChannelNonce,
      );
      globalChannelNonce += 1;
      await setChallenge();
      await expect(respond()).to.be.revertedWith(
        "respondToChallenge called with an app identity that has a zero default timeout",
      );
    });

    it("should fail if apply action fails", async () => {
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

    it("should fail if there is an overflow", async () => {
      await setChallenge();
      try {
        await respond(undefined, undefined, undefined, undefined, 1e24);
      } catch (e) {
        expect(e.message.includes(`underflow`)).to.be.true;
      }
    });

    it("should successfully respond to a challenge with a valid action", async () => {
      await setChallenge();
      await respond();
    });
  });

  describe("Responds to the challenge by advancing the state", () => {
    it("should fail if trying to respond with an old state", async () => {
      await setChallenge();
      const challenge = await getChallenge(appIdentityTestObject.identityHash, challengeRegistry);
      expect(challenge.versionNumber).to.be.eq(1);
      await expect(
        respond(getAppWithActionState(5), undefined, undefined, Zero),
      ).to.be.revertedWith("revert respondToChallenge was called with outdated state");
    });

    it("should fail if there is an overflow", async () => {
      await setChallenge();
      try {
        await respond(getAppWithActionState(5), undefined, undefined, undefined, 1e24);
      } catch (e) {
        expect(e.message.includes(`underflow`)).to.be.true;
      }
    });

    it("should be able to respond to a challenge with a newer state", async () => {
      await setChallenge();
      let challenge = await getChallenge(appIdentityTestObject.identityHash, challengeRegistry);
      expect(challenge.versionNumber).to.be.eq(1);
      await respond(getAppWithActionState(5), undefined, undefined, 8);
      challenge = await getChallenge(appIdentityTestObject.identityHash, challengeRegistry);
      expect(challenge.versionNumber).to.be.eq(8);
    });
  });
});
