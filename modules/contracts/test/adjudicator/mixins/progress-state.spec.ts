/* global before */
import { ChannelSigner } from "@connext/crypto";
import { AppChallengeBigNumber } from "@connext/types";
import { Wallet, Contract, ContractFactory } from "ethers";
import { keccak256 } from "ethers/utils";

import {
  expect,
  computeActionHash,
  AppWithCounterState,
  AppWithCounterAction,
  snapshot,
  restore,
  moveToBlock,
  encodeState,
  encodeAction,
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
  let PRE_STATE: AppWithCounterState;
  let POST_STATE: AppWithCounterState;
  let ONCHAIN_CHALLENGE_TIMEOUT: number;

  let setState: (versionNumber: number, appState?: string, timeout?: number) => Promise<void>;
  let progressState: (
    state: AppWithCounterState,
    action: AppWithCounterAction,
    actionSig: string,
  ) => Promise<void>;
  let verifyChallenge: (expected: Partial<AppChallengeBigNumber>) => Promise<void>;
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

  it("Can be called multiple times", async () => {
    await setState(1, encodeState(PRE_STATE));

    expect(await isProgressable()).to.be.false;
    await moveToBlock((await provider.getBlockNumber()) + ONCHAIN_CHALLENGE_TIMEOUT + 3);
    await progressStateAndVerify(PRE_STATE, ACTION);

    const thingToSign2 = computeActionHash(
      ALICE.address,
      keccak256(encodeState(POST_STATE)),
      encodeAction(ACTION),
      2,
    );
    const signature2 = await (new ChannelSigner(ALICE.privateKey).signMessage(thingToSign2));
    await progressState(POST_STATE, ACTION, signature2);
  });

  it("Cannot call progressState with incorrect turn taker", async () => {
    await setState(1, encodeState(PRE_STATE));

    await moveToBlock((await provider.getBlockNumber()) + ONCHAIN_CHALLENGE_TIMEOUT + 3);

    await expect(progressStateAndVerify(PRE_STATE, ACTION, ALICE)).to.be.revertedWith(
      "progressState called with action signed by incorrect turn taker",
    );
  });

  it("progressState should fail if incorrect state submitted", async () => {
    await setState(1, encodeState(PRE_STATE));

    await moveToBlock((await provider.getBlockNumber()) + ONCHAIN_CHALLENGE_TIMEOUT + 3);

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
    const signature = await (new ChannelSigner(ALICE.privateKey).signMessage(thingToSign));

    expect(await isProgressable()).to.be.false;
    await expect(progressState(POST_STATE, ACTION, signature)).to.be.revertedWith(
      "progressState called on app not in a progressable state",
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
});
