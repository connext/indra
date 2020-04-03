/* global before */
import { Contract, Wallet, ContractFactory } from "ethers";

import { expect, provider, snapshot, setupContext, AppWithCounterState, AppWithCounterAction, restore } from "../utils";

import AppWithAction from "../../../build/AppWithAction.json";
import ChallengeRegistry from "../../../build/ChallengeRegistry.json";

describe("setAndProgressState", () => {

  let appRegistry: Contract;
  let appDefinition: Contract;
  let wallet: Wallet;
  let snapshotId: any;

  // constants
  let state0: AppWithCounterState;
  let action: AppWithCounterAction;

  // helpers
  let setAndProgressState: (...args: any) => Promise<any>;
  let setAndProgressStateAndVerify: (...args: any) => Promise<any>;

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

    // get constants
    state0 = context["state0"];
    action = context["action"];

    // get helpers
    setAndProgressState = context["setAndProgressState"];
    setAndProgressStateAndVerify = context["setAndProgressStateAndVerify"];
  });

  afterEach(async () => {
    await restore(snapshotId);
  });

  it("should work if the timeout is 0", async () => {
    await setAndProgressStateAndVerify(1, state0, action);
  });

  it("should fail if timeout is nonzero", async () => {
    await expect(setAndProgressState(1, state0, action, 13)).to.be.revertedWith("progressState called on app not in a progressable state");
  });
});