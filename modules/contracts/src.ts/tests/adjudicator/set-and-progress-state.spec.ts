import { Wallet } from "ethers";

import { setupContext } from "../context";
import {
  AppWithCounterAction,
  AppWithCounterState,
  expect,
  provider,
  restore,
  snapshot,
} from "../utils";

describe("setAndProgressState", () => {
  let wallet: Wallet;

  // constants
  let state0: AppWithCounterState;
  let action: AppWithCounterAction;

  // helpers
  let setAndProgressState: (...args: any) => Promise<any>;
  let setAndProgressStateAndVerify: (...args: any) => Promise<any>;

  before(async () => {
    wallet = (await provider.getWallets())[0];
    await wallet.getTransactionCount();
  });

  beforeEach(async () => {
    const context = await setupContext();

    // get constants
    state0 = context["state0"];
    action = context["action"];

    // get helpers
    setAndProgressState = context["setAndProgressState"];
    setAndProgressStateAndVerify = context["setAndProgressStateAndVerify"];
  });

  it("should work if the timeout is 0", async () => {
    await setAndProgressStateAndVerify(1, state0, action);
  });

  it("should fail if timeout is nonzero", async () => {
    await expect(setAndProgressState(1, state0, action, 13)).to.be.revertedWith(
      "progressState called on app not in a progressable state",
    );
  });
});
