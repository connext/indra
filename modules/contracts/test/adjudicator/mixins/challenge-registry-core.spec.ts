/* global before */
import { Contract, Wallet, ContractFactory } from "ethers";
import { One } from "ethers/constants";
import { ChallengeStatus, AppChallengeBigNumber } from "@connext/types";
import { toBN } from "@connext/utils";
import { keccak256 } from "ethers/utils";

import { expect, provider, restore, setupContext, snapshot, moveToBlock, encodeState, AppWithCounterState, AppWithCounterAction } from "../utils";

import AppWithAction from "../../../build/AppWithAction.json";
import ChallengeRegistry from "../../../build/ChallengeRegistry.json";

describe("MChallengeRegistryCore", () => {

  let appRegistry: Contract;
  let appDefinition: Contract;

  let wallet: Wallet;

  let snapshotId: any;

  let ONCHAIN_CHALLENGE_TIMEOUT: number;
  let alice: Wallet;
  let action: AppWithCounterAction;

  let setState: (versionNumber: number, appState?: string, timeout?: number) => Promise<void>;
  let setAndProgressState: (
    versionNumber: number,
    state?: AppWithCounterState,
    turnTaker?: Wallet,
  ) => Promise<void>;

  let verifyChallenge: (expected: Partial<AppChallengeBigNumber>) => Promise<void>;
  let isFinalized: () => Promise<boolean>;

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

    ONCHAIN_CHALLENGE_TIMEOUT = context["ONCHAIN_CHALLENGE_TIMEOUT"];
    alice = context["alice"];
    action = context["action"];

    setState = context["setState"];
    isFinalized = context["isFinalized"];
    verifyChallenge = context["verifyChallenge"];
    setAndProgressState = 
      (versionNumber: number, state?: AppWithCounterState, turnTaker?: Wallet) => context["setAndProgressState"](
        versionNumber, // nonce
        state || context["state0"], // state
        context["action"], // action
        undefined, // timeout
        turnTaker || context["bob"], // turn taker
      );
  });

  afterEach(async () => {
    await restore(snapshotId);
  });

  describe("isFinalized", () => {
    it("should return true if state is explicitly finalized", async () => {
      const state = { counter: toBN(10) };
      // NOTE: cannot get to `EXPLICITLY_FINALIZED` status without calling
      // `progressState`. This is because `MixinSetState` only has access
      // to the state hash, and cannot call `isStateTerminal` on the
      // counterfactual app
      const resultingState = { counter: state.counter.add(action.increment) };
      await setAndProgressState(1, state, alice);
      await verifyChallenge({
        appStateHash: keccak256(encodeState(resultingState)),
        versionNumber: toBN(2),
        status: ChallengeStatus.EXPLICITLY_FINALIZED,
      });

      expect(await isFinalized()).to.be.true;
    });

    it("should return true if set state period elapsed", async () => {
      await setState(1);
      await verifyChallenge({
        versionNumber: One,
        status: ChallengeStatus.IN_DISPUTE,
      });

      // must have passed:
      // appChallenge.finalizesAt.add(defaultTimeout))
      await moveToBlock(
        await provider.getBlockNumber() + ONCHAIN_CHALLENGE_TIMEOUT + ONCHAIN_CHALLENGE_TIMEOUT + 2,
      );

      expect(await isFinalized()).to.be.true;
    });

    it("should return true if state progression period elapsed", async () => {
      await setAndProgressState(1);
      await verifyChallenge({
        versionNumber: toBN(2),
        status: ChallengeStatus.IN_ONCHAIN_PROGRESSION,
      });

      // must have passed:
      // appChallenge.finalizesAt
      await moveToBlock(await provider.getBlockNumber() + ONCHAIN_CHALLENGE_TIMEOUT + 2);

      expect(await isFinalized()).to.be.true;
    });

    it("should return false if challenge is in set state period", async () => {
      await setState(1);
      await verifyChallenge({
        versionNumber: One,
        status: ChallengeStatus.IN_DISPUTE,
      });

      expect(await isFinalized()).to.be.false;
    });

    it("should return false if challenge is in state progression period", async () => {
      await setAndProgressState(1);
      await verifyChallenge({
        versionNumber: toBN(2),
        status: ChallengeStatus.IN_ONCHAIN_PROGRESSION,
      });

      expect(await isFinalized()).to.be.false;
    });

    it("should return false if challenge is empty", async () => {
      expect(await isFinalized()).to.be.false;
    });
  });
});
