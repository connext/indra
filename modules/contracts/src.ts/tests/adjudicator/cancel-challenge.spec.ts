import { ChannelSigner, computeCancelDisputeHash, getRandomPrivateKey, toBN } from "@connext/utils";
import { Wallet } from "ethers";

import { setupContext } from "../context";
import {
  AppWithCounterClass,
  AppWithCounterState,
  expect,
  restore,
  snapshot,
  sortSignaturesBySignerAddress,
} from "../utils";

describe("cancelDispute", () => {
  let appInstance: AppWithCounterClass;
  let bob: Wallet;

  let isDisputable: () => Promise<boolean>;
  let isProgressable: () => Promise<boolean>;

  let setState: (versionNumber: number, appState?: string, timeout?: number) => Promise<void>;
  let setAndProgressState: (
    versionNumber: number,
    state?: AppWithCounterState,
    turnTaker?: Wallet,
  ) => Promise<void>;
  let cancelDispute: (versionNumber: number, signatures?: string[]) => Promise<void>;
  let cancelDisputeAndVerify: (versionNumber: number, signatures?: string[]) => Promise<void>;

  beforeEach(async () => {
    const context = await setupContext();

    // app instance
    appInstance = context["appInstance"];
    bob = context["bob"];

    // helpers
    isProgressable = context["isProgressable"];
    isDisputable = context["isDisputable"];

    setState = context["setStateAndVerify"];
    setAndProgressState = (
      versionNumber: number,
      state?: AppWithCounterState,
      turnTaker?: Wallet,
    ) =>
      context["setAndProgressStateAndVerify"](
        versionNumber, // nonce
        state || context["state0"], // state
        context["action"], // action
        undefined, // timeout
        turnTaker || bob, // turn taker
      );
    cancelDispute = context["cancelDispute"];
    cancelDisputeAndVerify = context["cancelDisputeAndVerify"];
  });

  it("works", async () => {
    // when in progress state phase
    await setAndProgressState(1);
    expect(await isProgressable()).to.be.true;
    await cancelDisputeAndVerify(2);
  });

  it("fails if is not cancellable", async () => {
    await expect(cancelDispute(0)).to.be.revertedWith(
      "cancelDispute called on challenge that cannot be cancelled",
    );
  });

  it("fails if called in set state phase", async () => {
    await setState(1);
    expect(await isDisputable()).to.be.true;
    await expect(cancelDispute(1)).to.be.revertedWith(
      "VM Exception while processing transaction: revert cancelDispute called on challenge that cannot be cancelled",
    );
  });

  it("fails if incorrect sigs", async () => {
    const versionNumber = 2;
    await setAndProgressState(versionNumber);
    expect(await isProgressable()).to.be.true;

    const digest = computeCancelDisputeHash(appInstance.identityHash, toBN(versionNumber));
    const signatures = await sortSignaturesBySignerAddress(digest, [
      await new ChannelSigner(getRandomPrivateKey()).signMessage(digest),
      await new ChannelSigner(bob.privateKey).signMessage(digest),
    ]);
    await expect(cancelDispute(versionNumber, signatures)).to.be.revertedWith("Invalid signature");
  });

  it("fails if wrong version number submitted", async () => {
    // when in set state phase
    await setAndProgressState(1);
    expect(await isProgressable()).to.be.true;
    await expect(cancelDispute(1)).to.be.revertedWith(
      "cancelDispute was called with wrong version number",
    );
  });
});
