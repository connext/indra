/* global before */
import { ChallengeStatus, AppChallengeBigNumber } from "@connext/types";
import { toBN } from "@connext/utils";
import { Contract, Wallet, ContractFactory } from "ethers";
import { keccak256 } from "ethers/utils";

import AppWithAction from "../../build/AppWithAction.json";
import ChallengeRegistry from "../../build/ChallengeRegistry.json";

import {
  expect,
  provider,
  restore,
  setupContext,
  snapshot,
  AppWithCounterState,
  AppWithCounterAction,
  encodeState,
  moveToBlock,
} from "./utils";

describe("ChallengeRegistry", () => {
  let appRegistry: Contract;
  let appDefinition: Contract;
  let wallet: Wallet;

  let snapshotId: any;

  let ONCHAIN_CHALLENGE_TIMEOUT: number;
  let alice: Wallet;
  let action: AppWithCounterAction;
  let state1: AppWithCounterState;
  let state0: AppWithCounterState;

  // helpers
  let setState: (versionNumber: number, appState?: string, timeout?: number) => Promise<void>;
  let setAndProgressState: (
    versionNumber: number,
    state?: AppWithCounterState,
    turnTaker?: Wallet,
  ) => Promise<void>;
  let setOutcome: (finalState?: string) => Promise<void>;
  let progressState: (
    state: AppWithCounterState,
    action: AppWithCounterAction,
    signer: Wallet,
  ) => Promise<void>;
  let progressStateAndVerify: (
    state: AppWithCounterState,
    action: AppWithCounterAction,
    signer?: Wallet,
  ) => Promise<void>;
  let cancelDisputeAndVerify: (versionNumber: number, signatures?: string[]) => Promise<void>;

  let verifyChallenge: (expected: Partial<AppChallengeBigNumber>) => Promise<void>;
  let isProgressable: () => Promise<boolean>;

  before(async () => {
    // TODO: sometimes using the [0] indexed wallet will fail to deploy the
    // contracts in the first test suite (almost like a promised tx isnt
    // completed). Hacky fix -- use a different wallet
    wallet = (await provider.getWallets())[2];

    appRegistry = await new ContractFactory(
      ChallengeRegistry.abi as any,
      ChallengeRegistry.bytecode,
      wallet,
    ).deploy();
    appRegistry = await appRegistry.deployed();

    appDefinition = await new ContractFactory(
      AppWithAction.abi as any,
      AppWithAction.bytecode,
      wallet,
    ).deploy();
    appDefinition = await appDefinition.deployed();
  });

  beforeEach(async () => {
    snapshotId = await snapshot();
    const context = await setupContext(appRegistry, appDefinition, wallet);

    // apps / constants
    ONCHAIN_CHALLENGE_TIMEOUT = context["ONCHAIN_CHALLENGE_TIMEOUT"];
    alice = context["alice"];
    state0 = context["state0"];
    action = context["action"];
    state1 = context["state1"];

    // helpers
    setState = context["setStateAndVerify"];
    progressState = context["progressState"];
    progressStateAndVerify = context["progressStateAndVerify"];
    setOutcome = context["setOutcomeAndVerify"];
    setAndProgressState = (
      versionNumber: number,
      state?: AppWithCounterState,
      turnTaker?: Wallet,
    ) =>
      context["setAndProgressStateAndVerify"](
        versionNumber, // nonce
        state || state0, // state
        action, // action
        undefined, // timeout
        turnTaker || context["bob"], // turn taker
      );
    verifyChallenge = context["verifyChallenge"];
    isProgressable = context["isProgressable"];
    cancelDisputeAndVerify = context["cancelDisputeAndVerify"];
  });

  afterEach(async () => {
    await restore(snapshotId);
  });

  it("Can successfully dispute using: `setAndProgressState` + `progressState` + `setOutcome`", async () => {
    // first set the state
    await setAndProgressState(1, state0);

    // update with `progressState` to finalized state
    // state finalizes when counter > 5
    const finalizingAction = { ...action, increment: toBN(10) };
    await progressState(state1, finalizingAction, alice);
    // verify explicitly finalized
    const finalState = {
      counter: state1.counter.add(finalizingAction.increment),
    };
    await verifyChallenge({
      appStateHash: keccak256(encodeState(finalState)),
      status: ChallengeStatus.EXPLICITLY_FINALIZED,
      versionNumber: toBN(3),
    });

    // set + verify outcome
    await setOutcome(encodeState(finalState));
  });

  it("Can successfully dispute using: `setState` + `setState` + `setOutcome`", async () => {
    await setState(1, encodeState(state0));

    await setState(10, encodeState(state0));

    await setState(15, encodeState(state0));

    await moveToBlock((await provider.getBlockNumber()) + ONCHAIN_CHALLENGE_TIMEOUT + 15);

    await setOutcome(encodeState(state0));
  });

  it("Can successfully dispute using: `setState` + `progressState` + `progressState` + `setOutcome`", async () => {
    await setState(1, encodeState(state0));

    await setState(10, encodeState(state0));

    await setState(15, encodeState(state0));

    await moveToBlock((await provider.getBlockNumber()) + ONCHAIN_CHALLENGE_TIMEOUT + 2);
    expect(await isProgressable()).to.be.true;

    await progressStateAndVerify(state0, action);
    await progressStateAndVerify(state1, action, alice);

    await moveToBlock((await provider.getBlockNumber()) + ONCHAIN_CHALLENGE_TIMEOUT + 15);
    expect(await isProgressable()).to.be.false;

    await setOutcome(
      encodeState({
        ...state1,
        counter: state1.counter.add(action.increment),
      }),
    );
  });

  it("Cannot cancel challenge at `setState` phase", async () => {
    await setState(1, encodeState(state0));
    await expect(cancelDisputeAndVerify(1)).to.be.revertedWith(
      "cancelDispute called on challenge that cannot be cancelled",
    );

    await setState(15, encodeState(state0));
    await expect(cancelDisputeAndVerify(15)).to.be.revertedWith(
      "cancelDispute called on challenge that cannot be cancelled",
    );
  });

  it("Can cancel challenge at `progressState` phase", async () => {
    await setAndProgressState(1, state0);
    await cancelDisputeAndVerify(2);

    await setAndProgressState(2, state0);
    await cancelDisputeAndVerify(3);
  });

  it("Cannot cancel challenge after outcome set", async () => {
    await setState(1, encodeState(state0));

    await moveToBlock((await provider.getBlockNumber()) + ONCHAIN_CHALLENGE_TIMEOUT + 15);

    await setOutcome(encodeState(state0));
    await expect(cancelDisputeAndVerify(1)).to.be.revertedWith(
      "cancelDispute called on challenge that cannot be cancelled",
    );
  });
});
