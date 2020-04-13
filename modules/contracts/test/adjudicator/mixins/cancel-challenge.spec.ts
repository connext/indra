/* global before */
import { Contract, Wallet, ContractFactory } from "ethers";

import {
  expect,
  restore,
  snapshot,
  setupContext,
  provider,
  AppWithCounterState,
  computeCancelDisputeHash,
  AppWithCounterClass,
} from "../utils";

import AppWithAction from "../../../build/AppWithAction.json";
import ChallengeRegistry from "../../../build/ChallengeRegistry.json";
import { sortSignaturesBySignerAddress, toBN } from "@connext/types";
import { signChannelMessage, verifyChannelMessage } from "@connext/crypto";

describe("cancelDispute", () => {
  let appRegistry: Contract;
  let appDefinition: Contract;
  let wallet: Wallet;
  let snapshotId: number;

  // app instance
  let appInstance: AppWithCounterClass;
  let bob: Wallet;

  // helpers
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

  afterEach(async () => {
    await restore(snapshotId);
  });

  it("works", async () => {
    // when in set state phase
    await setState(1);
    expect(await isDisputable()).to.be.true;
    await cancelDisputeAndVerify(1);

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

  it("fails if incorrect sigs", async () => {
    const versionNumber = 2;
    await setState(versionNumber);

    const digest = computeCancelDisputeHash(appInstance.identityHash, toBN(versionNumber));
    const signatures = await sortSignaturesBySignerAddress(
      digest,
      [
        await signChannelMessage(wallet.privateKey, digest),
        await signChannelMessage(bob.privateKey, digest),
      ],
      verifyChannelMessage,
    );
    await expect(cancelDispute(versionNumber, signatures)).to.be.revertedWith(
      "Invalid signature",
    );
  });

  it("fails if wrong version number submitted", async () => {
    // when in set state phase
    await setState(1);
    await expect(cancelDispute(2)).to.be.revertedWith(
      "cancelDispute was called with wrong version number",
    );
  });
});
