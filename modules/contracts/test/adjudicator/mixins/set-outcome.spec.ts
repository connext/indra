/* global before */
import * as waffle from "ethereum-waffle";
import { Contract, Wallet } from "ethers";

import { setupContext, snapshot, provider, restore, AppWithCounterState, moveToBlock, expect, encodeState } from "../utils";

import AppWithAction from "../../../build/AppWithAction.json";
import AppComputeOutcomeFails from "../../../build/AppComputeOutcomeFails.json";
import ChallengeRegistry from "../../../build/ChallengeRegistry.json";

describe("setOutcome", () => {

  let appRegistry: Contract;
  let appDefinition: Contract;
  let wallet: Wallet;

  let snapshotId: any;

  // constants
  let ONCHAIN_CHALLENGE_TIMEOUT: number;
  let state0: AppWithCounterState;
  let state1: AppWithCounterState;

  // helpers
  let setOutcome: (finalState?: string) => Promise<void>;
  let setAndProgressState: (versionNumber: number, state?: AppWithCounterState, turnTaker?: Wallet) => Promise<void>;

  let isStateFinalized: () => Promise<boolean>;

  before(async () => {
    wallet = (await provider.getWallets())[0];
    await wallet.getTransactionCount();

    appRegistry = await waffle.deployContract(wallet, ChallengeRegistry);
    appDefinition = await waffle.deployContract(wallet, AppWithAction);
  });

  beforeEach(async () => {
    snapshotId = await snapshot();
    const context = await setupContext(appRegistry, appDefinition);

    // apps/constants
    ONCHAIN_CHALLENGE_TIMEOUT = context["ONCHAIN_CHALLENGE_TIMEOUT"];
    state0 = context["state0"];
    state1 = context["state1"];

    // helpers
    setOutcome = context["setOutcomeAndVerify"];
    isStateFinalized = context["isStateFinalized"];
    setAndProgressState = 
      (versionNumber: number, state?: AppWithCounterState, turnTaker?: Wallet) => context["setAndProgressStateAndVerify"](
        versionNumber, // nonce
        state || state0, // state
        context["action"], // action
        undefined, // timeout
        turnTaker || context["bob"], // turn taker
      );
  });

  afterEach(async () => {
    await restore(snapshotId);
  });


  it("works", async () => {
    await setAndProgressState(1);

    // must have passed:
    // appChallenge.finalizesAt
    await moveToBlock(await provider.getBlockNumber() + ONCHAIN_CHALLENGE_TIMEOUT + 2);

    expect(await isStateFinalized()).to.be.true;

    await setOutcome(encodeState(state1));
  });

  it("fails if incorrect final state", async () => {
    await setAndProgressState(1);

    // must have passed:
    // appChallenge.finalizesAt
    await moveToBlock(await provider.getBlockNumber() + ONCHAIN_CHALLENGE_TIMEOUT + 2);

    expect(await isStateFinalized()).to.be.true;

    await expect(setOutcome(encodeState(state0))).to.be.revertedWith("setOutcome called with incorrect witness data of finalState");
  });

  it("fails if not finalized", async () => {
    await setAndProgressState(1);
    expect(await isStateFinalized()).to.be.false;

    await expect(setOutcome(encodeState(state0))).to.be.revertedWith("setOutcome can only be called after a challenge has been finalized");
  });

  it("fails if compute outcome fails", async () => {
    const failingApp = await waffle.deployContract(wallet, AppComputeOutcomeFails);
    const context = await setupContext(appRegistry, failingApp);

    await context["setAndProgressStateAndVerify"](
      1, // nonce
      context["state0"], // state
      context["action"], // action
      undefined, // timeout
      context["bob"], // turn taker
    );

    // must have passed:
    // appChallenge.finalizesAt
    await moveToBlock(await provider.getBlockNumber() + ONCHAIN_CHALLENGE_TIMEOUT + 2);

    expect(await context["isStateFinalized"]()).to.be.true;

    await expect(context["setOutcomeAndVerify"](encodeState(context["state1"]))).to.be.revertedWith("computeOutcome always fails for this app");
  });
});