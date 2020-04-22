/* global before */
import { AppChallenge } from "@connext/types";
import { Wallet, Contract, ContractFactory } from "ethers";

import {
  expect,
  AppWithCounterState,
  AppWithCounterAction,
  snapshot,
  restore,
  moveToBlock,
  encodeState,
  setupContext,
  EMPTY_CHALLENGE,
  provider,
} from "../utils";

import AppWithAction from "../../../build/AppWithAction.json";
import AppApplyActionFails from "../../../build/AppApplyActionFails.json";
import ChallengeRegistry from "../../../build/ChallengeRegistry.json";

describe("progressState", () => {
  let appRegistry: Contract;
  let appDefinition: Contract;

  let wallet: Wallet;
  let ALICE: Wallet;
  let BOB: Wallet;

  let snapshotId: any;

  let ACTION: AppWithCounterAction;
  let EXPLICITLY_FINALIZING_ACTION: AppWithCounterAction;
  let PRE_STATE: AppWithCounterState;
  let POST_STATE: AppWithCounterState;
  let ONCHAIN_CHALLENGE_TIMEOUT: number;

  let setState: (versionNumber: number, appState?: string, timeout?: number) => Promise<void>;
  let progressState: (
    state: AppWithCounterState,
    action: AppWithCounterAction,
    signer: Wallet,
    resultingState?: AppWithCounterState,
    resultingStateVersionNumber?: number,
    resultingStateTimeout?: number,
  ) => Promise<void>;
  let verifyChallenge: (expected: Partial<AppChallenge>) => Promise<void>;
  let isProgressable: () => Promise<boolean>;
  let progressStateAndVerify: (
    state: AppWithCounterState,
    action: AppWithCounterAction,
    signer?: Wallet,
  ) => Promise<void>;

  before(async () => {
    wallet = (await provider.getWallets())[0];
    await wallet.getTransactionCount();

    appRegistry = await new ContractFactory(
      ChallengeRegistry.abi as any,
      ChallengeRegistry.bytecode,
      wallet,
    ).deploy();
    appDefinition = await new ContractFactory(
      AppWithAction.abi as any,
      AppWithAction.bytecode,
      wallet,
    ).deploy();
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
    EXPLICITLY_FINALIZING_ACTION = context["explicitlyFinalizingAction"];
    ONCHAIN_CHALLENGE_TIMEOUT = context["ONCHAIN_CHALLENGE_TIMEOUT"];

    // get helpers
    setState = context["setStateAndVerify"];
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

    await setState(1, encodeState(PRE_STATE));

    expect(await isProgressable()).to.be.false;
    await moveToBlock((await provider.getBlockNumber()) + ONCHAIN_CHALLENGE_TIMEOUT + 3);
    expect(await isProgressable()).to.be.true;

    await progressStateAndVerify(PRE_STATE, ACTION);
  });

  it("Can call progressState with explicitly finalizing action", async () => {
    await setState(1, encodeState(PRE_STATE));

    expect(await isProgressable()).to.be.false;
    await moveToBlock((await provider.getBlockNumber()) + ONCHAIN_CHALLENGE_TIMEOUT + 3);
    expect(await isProgressable()).to.be.true;

    await progressStateAndVerify(PRE_STATE, EXPLICITLY_FINALIZING_ACTION);
  });

  it("Can be called multiple times", async () => {
    await setState(1, encodeState(PRE_STATE));

    expect(await isProgressable()).to.be.false;
    await moveToBlock((await provider.getBlockNumber()) + ONCHAIN_CHALLENGE_TIMEOUT + 3);
    await progressStateAndVerify(PRE_STATE, ACTION);

    await progressState(POST_STATE, ACTION, ALICE);
  });

  it("progressState should fail if dispute is not progressable", async () => {
    await setState(1, encodeState(PRE_STATE));

    expect(await isProgressable()).to.be.false;
    await expect(progressState(POST_STATE, ACTION, ALICE)).to.be.revertedWith(
      "progressState called on app not in a progressable state",
    );
  });

  it("progressState should fail if incorrect state submitted", async () => {
    await setState(1, encodeState(PRE_STATE));

    await moveToBlock((await provider.getBlockNumber()) + ONCHAIN_CHALLENGE_TIMEOUT + 3);

    await expect(progressStateAndVerify(POST_STATE, ACTION)).to.be.revertedWith(
      "progressState called with oldAppState that does not match stored challenge",
    );
  });

  it("progressState should fail with incorrect turn taker", async () => {
    await setState(1, encodeState(PRE_STATE));

    await moveToBlock((await provider.getBlockNumber()) + ONCHAIN_CHALLENGE_TIMEOUT + 3);

    await expect(progressStateAndVerify(PRE_STATE, ACTION, ALICE)).to.be.revertedWith(
      /*
       TODO: Temporary solution. Proper fix: The `verifySignatures` contract function
       shouldn't revert, but just return `false`.
      "Call to progressState included incorrectly signed state update",
      */
      "Invalid signature",
    );
  });

  it("progressState should fail if apply action fails", async () => {
    const failingApp = await new ContractFactory(
      AppApplyActionFails.abi as any,
      AppApplyActionFails.bytecode,
      wallet,
    ).deploy();
    const context = await setupContext(appRegistry, failingApp);

    await context["setStateAndVerify"](1, encodeState(context["state0"]));

    await moveToBlock((await provider.getBlockNumber()) + ONCHAIN_CHALLENGE_TIMEOUT + 3);
    expect(await context["isProgressable"]()).to.be.true;

    await expect(
      context["progressStateAndVerify"](context["state0"], context["action"]),
    ).to.be.revertedWith("applyAction fails for this app");
  });

  it("progressState should fail if applying action to old state does not match new state", async () => {
    await setState(1, encodeState(PRE_STATE));

    await moveToBlock((await provider.getBlockNumber()) + ONCHAIN_CHALLENGE_TIMEOUT + 3);

    await expect(progressState(PRE_STATE, ACTION, BOB, PRE_STATE)).to.be.revertedWith(
      "progressState: applying action to old state does not match new state",
    );
  });

  it("progressState should fail if versionNumber of new state is not that of stored state plus 1", async () => {
    await setState(1, encodeState(PRE_STATE));

    await moveToBlock((await provider.getBlockNumber()) + ONCHAIN_CHALLENGE_TIMEOUT + 3);

    await expect(progressState(PRE_STATE, ACTION, BOB, POST_STATE, 1)).to.be.revertedWith(
      "progressState: versionNumber of new state is not that of stored state plus 1",
    );
  });

});
