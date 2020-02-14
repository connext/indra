/* global before */
import { waffle as buidler } from "@nomiclabs/buidler";
import { Wallet, Contract } from "ethers";
import {
  expect,
  AppIdentityTestClass,
  getAppWithActionState,
  encodeAppAction,
  deployRegistry,
  deployApp,
  latestVersionNumber,
  encodeAppState,
  getIncrementCounterAction,
  setStateWithSignedAction,
  ONCHAIN_CHALLENGE_TIMEOUT,
  Challenge,
  getChallenge,
  ChallengeStatus,
  setStateWithSignatures,
  computeAppChallengeHash,
  sortSignaturesBySignerAddress,
  computeActionHash,
} from "../utils";
import { Zero, One } from "ethers/constants";
import { BigNumberish, keccak256, bigNumberify, BigNumber, SigningKey, joinSignature } from "ethers/utils";

const alice =
  // 0xaeF082d339D227646DB914f0cA9fF02c8544F30b
  new Wallet("0x3570f77380e22f8dc2274d8fd33e7830cc2d29cf76804e8c21f4f7a6cc571d27");

const bob =
  // 0xb37e49bFC97A948617bF3B63BC6942BB15285715
  new Wallet("0x4ccac8b1e81fb18a98bbaf29b9bfe307885561f71b76bd4680d7aec9d0ddfcfd");

describe("MixinSetState.sol", () => {
  const provider = buidler.provider;
  const encodedState = encodeAppState(getAppWithActionState());
  const encodedAction = encodeAppAction(getIncrementCounterAction());
  let wallet: Wallet;
  let globalChannelNonce = 0;
  let versionNumber: BigNumber;

  let appWithAction: Contract;
  let appWithActionFailing: Contract;
  let challengeRegistry: Contract;
  let appIdentityTestObject: AppIdentityTestClass;

  let setStateWithAction: (
    action?: string,
    appState?: string,
    turnTaker?: Wallet,
    timeout?: BigNumberish,
    versionNo?: BigNumberish,
    appIdentity?: AppIdentityTestClass,
  ) => Promise<Challenge>;

  before(async () => {
    // deploy contract, set provider/wallet
    wallet = (await provider.getWallets())[0];

    challengeRegistry = await deployRegistry(wallet);
    appWithAction = await deployApp(wallet);
    appWithActionFailing = await deployApp(wallet, { applyActionFails: true });
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

    versionNumber = await latestVersionNumber(appIdentityTestObject.identityHash, challengeRegistry);
    expect(versionNumber).to.be.equal(Zero);

    setStateWithAction = async (
      action: string = encodedAction,
      appState: string = encodedState,
      turnTaker: Wallet = bob,
      timeout: BigNumberish = ONCHAIN_CHALLENGE_TIMEOUT,
      versionNo: BigNumberish = versionNumber.add(1),
      appIdentity: AppIdentityTestClass = appIdentityTestObject,
    ): Promise<Challenge> => {
      await setStateWithSignedAction(
        appIdentity,
        [alice, bob],
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
        challengeCounter: One,
        finalizesAt: bigNumberify(appIdentity.defaultTimeout).add(await provider.getBlockNumber()),
        latestSubmitter: wallet.address,
        status: bigNumberify(timeout).isZero()
          ? ChallengeStatus.EXPLICITLY_FINALIZED
          : ChallengeStatus.FINALIZES_AFTER_DEADLINE,
        versionNumber: One,
      });
      return challenge;
    };
  });

  it("should correctly set the state of a challenge and take an action against the state", async () => {
    await setStateWithAction();
  });

  it("should fail if the version number is outdated", async () => {
    await setStateWithAction();
    await expect(setStateWithAction()).to.be.revertedWith(`setStateWithAction was called with outdated state`);
  });

  it("should fail if the signatures on the action are incorrect", async () => {
    await expect(setStateWithAction(undefined, undefined, alice)).to.be.revertedWith(
      `setStateWithAction called with action signed by incorrect turn taker`,
    );
  });

  it("should fail if the timeouts are 0", async () => {
    await expect(setStateWithAction(undefined, undefined, undefined, 0)).to.be.revertedWith(
      `Timeout must be greater than 0`,
    );
  });

  it("should fail if the timeout < finalizes", async () => {
    try {
      await setStateWithAction(undefined, undefined, undefined, 1e24);
    } catch (e) {
      expect(e.message.includes(`underflow`)).to.be.true;
    }
  });

  it("should fail if the challenge is finalized", async () => {
    await setStateWithSignatures(
      appIdentityTestObject,
      [alice, bob],
      challengeRegistry,
      versionNumber.add(1),
      encodedAction,
      0,
    );
    const challenge = await getChallenge(appIdentityTestObject.identityHash, challengeRegistry);
    expect(challenge.status).to.be.equal(ChallengeStatus.EXPLICITLY_FINALIZED);
    await expect(setStateWithAction()).to.be.revertedWith(
      `setStateWithAction was called on an app that has already been finalized`,
    );
  });

  it("should fail if the signatures on the state are incorrect", async () => {
    const stateHash = keccak256(encodedState);
    const submittedVersionNo = versionNumber.add(1);
    const timeout = Zero;
    const stateDigest = computeAppChallengeHash(
      appIdentityTestObject.identityHash,
      stateHash,
      submittedVersionNo,
      timeout,
    );
    const stateSigs = sortSignaturesBySignerAddress(stateDigest, [
      await new SigningKey(alice.privateKey).signDigest(stateDigest),
      await new SigningKey(bob.privateKey).signDigest(stateDigest),
    ]).map(joinSignature);
    const actionDigest = computeActionHash(
      bob.address,
      stateHash,
      encodedAction,
      bigNumberify(versionNumber).toNumber(),
    );
    const actionSig = joinSignature(await new SigningKey(bob.privateKey).signDigest(actionDigest));
    await expect(
      challengeRegistry.functions.setStateWithAction(
        appIdentityTestObject.appIdentity,
        {
          appState: encodeAppState(getAppWithActionState(5)),
          signatures: stateSigs,
          timeout,
          versionNumber: bigNumberify(versionNumber),
        },
        {
          encodedAction,
          signature: actionSig,
        },
      ),
    ).to.be.revertedWith("Invalid signature");
  });

  it("should fail if applyAction fails", async () => {
    // create new appidentity
    const failingApp = new AppIdentityTestClass(
      [alice.address, bob.address], // participants
      appWithActionFailing.address, // app def
      10, // default timeout
      globalChannelNonce,
    );

    await expect(
      setStateWithAction(undefined, undefined, undefined, undefined, undefined, failingApp),
    ).to.be.revertedWith("The applyAction method has no implementation for this App");
  });
});
