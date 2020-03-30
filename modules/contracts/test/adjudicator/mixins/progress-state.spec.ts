/* global before */
import { ChallengeStatus, AppChallengeBigNumber } from "@connext/types";
import { signDigest } from "@connext/crypto";
import { Wallet, Contract } from "ethers";
import { One } from "ethers/constants";
import { keccak256 } from "ethers/utils";
import * as waffle from "ethereum-waffle";

import { expect, computeActionHash, AppWithCounterState, AppWithCounterAction, snapshot, restore, moveToBlock, encodeState, encodeAction, setupContext, EMPTY_CHALLENGE, provider } from "../utils";

import AppWithAction from "../../../build/AppWithAction.json";
import ChallengeRegistry from "../../../build/ChallengeRegistry.json";

describe("progressState", () => {
  let appRegistry: Contract;
  let appDefinition: Contract;

  let wallet: Wallet;
  let ALICE: Wallet;
  let BOB: Wallet;

  let snapshotId: any;

  let ACTION: AppWithCounterAction;
  let PRE_STATE: AppWithCounterState;
  let POST_STATE: AppWithCounterState;
  let ONCHAIN_CHALLENGE_TIMEOUT: number;

  let setState: (versionNumber: number, appState?: string, timeout?: number) => Promise<void>;
  let progressState: (state: AppWithCounterState, action: AppWithCounterAction, actionSig: string) => Promise<void>;
  let verifyChallenge: (expected: Partial<AppChallengeBigNumber>) => Promise<void>;
  let isProgressable: () => Promise<boolean>;
  let progressStateAndVerify: (state: AppWithCounterState, action: AppWithCounterAction, signer?: Wallet) => Promise<void>;

  before(async () => {
    wallet = (await provider.getWallets())[0];
    await wallet.getTransactionCount();

    appRegistry = await waffle.deployContract(wallet, ChallengeRegistry);
    appDefinition = await waffle.deployContract(wallet, AppWithAction);
  });

  beforeEach(async () => {
    snapshotId = await snapshot();
    const context = await setupContext(appRegistry, appDefinition);

    // apps
    ALICE = context["alice"];
    BOB = context["bob"];
    PRE_STATE = context["state0"];
    POST_STATE = context["state1"];
    ACTION = context["action"];
    ONCHAIN_CHALLENGE_TIMEOUT = context["ONCHAIN_CHALLENGE_TIMEOUT"];

    // get helpers
    setState = context["setState"];
    progressState = context["progressState"];
    verifyChallenge = context["verifyChallenge"];
    isProgressable = context["isProgressable"];
    progressStateAndVerify = context["progressStateAndVerify"];
  });

  afterEach(async () => {
    await restore(snapshotId);
  });

  it("Can call progressState", async () => {
    await verifyChallenge(EMPTY_CHALLENGE);

    const originalChallenge = {
      latestSubmitter: wallet.address,
      versionNumber: One,
      appStateHash: keccak256(encodeState(PRE_STATE)),
      status: ChallengeStatus.IN_DISPUTE,
    };
    await setState(1, encodeState(PRE_STATE));
    await verifyChallenge(originalChallenge);

    expect(await isProgressable()).to.be.false;
    await moveToBlock(ONCHAIN_CHALLENGE_TIMEOUT + 3);
    await progressStateAndVerify(PRE_STATE, ACTION);
  });

  it("Can be called multiple times", async () => {
    await setState(1, encodeState(PRE_STATE));

    const expected = {
      latestSubmitter: wallet.address,
      versionNumber: One,
      appStateHash: keccak256(encodeState(PRE_STATE)),
      status: ChallengeStatus.IN_DISPUTE,
    };
    await verifyChallenge(expected);

    expect(await isProgressable()).to.be.false;
    await moveToBlock(ONCHAIN_CHALLENGE_TIMEOUT + 3);
    await progressStateAndVerify(PRE_STATE, ACTION);

    const thingToSign2 = computeActionHash(
      ALICE.address,
      keccak256(encodeState(POST_STATE)),
      encodeAction(ACTION),
      2,
    );
    const signature2 = await signDigest(ALICE.privateKey, thingToSign2);
    await progressState(POST_STATE, ACTION, signature2);
  });

  it("Cannot call progressState with incorrect turn taker", async () => {
    await setState(1, encodeState(PRE_STATE));

    await moveToBlock(ONCHAIN_CHALLENGE_TIMEOUT + 3);

    await expect(progressStateAndVerify(PRE_STATE, ACTION, ALICE)).to.be.revertedWith(
      "progressState called with action signed by incorrect turn taker",
    );
  });

  it("progressState should fail if incorrect state submitted", async () => {
    await setState(1, encodeState(PRE_STATE));

    await moveToBlock(ONCHAIN_CHALLENGE_TIMEOUT + 3);

    await expect(progressStateAndVerify(POST_STATE, ACTION)).to.be.revertedWith(
      "Tried to progress a challenge with non-agreed upon app",
    );
  });

  it("progressState should fail if dispute is not progressable", async () => {
    await setState(1, encodeState(PRE_STATE));

    const thingToSign = computeActionHash(
      BOB.address,
      keccak256(encodeState(PRE_STATE)),
      encodeAction(ACTION),
      1,
    );
    const signature = await signDigest(ALICE.privateKey, thingToSign);

    expect(await isProgressable()).to.be.false;
    await expect(progressState(POST_STATE, ACTION, signature)).to.be.revertedWith(
      "progressState called on app not in a progressable state",
    );
  });

  it("progressState should fail if apply action fails", async () => {
    // TODO: how to make sure the action is invalid?
  });

});
