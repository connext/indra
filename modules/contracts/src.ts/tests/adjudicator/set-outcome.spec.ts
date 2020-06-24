import { Wallet, ContractFactory } from "ethers";

import { AppComputeOutcomeFails } from "../../artifacts";

import { setupContext } from "../context";
import {
  AppWithCounterState,
  encodeState,
  expect,
  mineBlocks,
  provider,
  restore,
  snapshot,
} from "../utils";

describe("setOutcome", () => {
  let wallet: Wallet;

  // constants
  let ONCHAIN_CHALLENGE_TIMEOUT: number;
  let state0: AppWithCounterState;
  let state1: AppWithCounterState;

  // helpers
  let setOutcome: (finalState?: string) => Promise<void>;
  let setAndProgressState: (
    versionNumber: number,
    state?: AppWithCounterState,
    turnTaker?: Wallet,
  ) => Promise<void>;

  let isFinalized: () => Promise<boolean>;

  before(async () => {
    wallet = (await provider.getWallets())[0];
    await wallet.getTransactionCount();
  });

  beforeEach(async () => {
    const context = await setupContext();

    // apps/constants
    ONCHAIN_CHALLENGE_TIMEOUT = context["ONCHAIN_CHALLENGE_TIMEOUT"];
    state0 = context["state0"];
    state1 = context["state1"];

    // helpers
    setOutcome = context["setOutcomeAndVerify"];
    isFinalized = context["isFinalized"];
    setAndProgressState = (
      versionNumber: number,
      state?: AppWithCounterState,
      turnTaker?: Wallet,
    ) =>
      context["setAndProgressStateAndVerify"](
        versionNumber, // nonce
        state || state0, // state
        context["action"], // action
        undefined, // timeout
        turnTaker || context["bob"], // turn taker
      );
  });

  it("works", async () => {
    await setAndProgressState(1);

    // must have passed:
    // appChallenge.finalizesAt
    await mineBlocks(ONCHAIN_CHALLENGE_TIMEOUT + 2);

    expect(await isFinalized()).to.be.true;

    await setOutcome(encodeState(state1));
  });

  it("fails if incorrect final state", async () => {
    await setAndProgressState(1);

    // must have passed:
    // appChallenge.finalizesAt
    await mineBlocks(ONCHAIN_CHALLENGE_TIMEOUT + 2);

    expect(await isFinalized()).to.be.true;

    await expect(setOutcome(encodeState(state0))).to.be.revertedWith(
      "setOutcome called with incorrect witness data of finalState",
    );
  });

  it("fails if not finalized", async () => {
    await setAndProgressState(1);
    expect(await isFinalized()).to.be.false;

    await expect(setOutcome(encodeState(state0))).to.be.revertedWith(
      "setOutcome can only be called after a challenge has been finalized",
    );
  });

  it("fails if compute outcome fails", async () => {
    const failingApp = await new ContractFactory(
      AppComputeOutcomeFails.abi,
      AppComputeOutcomeFails.bytecode,
      wallet,
    ).deploy();
    const context = await setupContext(failingApp);

    await context["setAndProgressStateAndVerify"](
      1, // nonce
      context["state0"], // state
      context["action"], // action
      undefined, // timeout
      context["bob"], // turn taker
    );

    // must have passed:
    // appChallenge.finalizesAt
    await mineBlocks(ONCHAIN_CHALLENGE_TIMEOUT + 2);

    expect(await context["isFinalized"]()).to.be.true;

    await expect(context["setOutcomeAndVerify"](encodeState(context["state1"]))).to.be.revertedWith(
      "computeOutcome always fails for this app",
    );
  });
});
