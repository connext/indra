/* global before */
import { AppChallenge, ChallengeStatus } from "@connext/types";
import { ChannelSigner, toBN } from "@connext/utils";
import { One } from "ethers/constants";
import { Contract, Wallet, ContractFactory } from "ethers";

import {
  randomState,
  appStateToHash,
  setupContext,
  expect,
  moveToBlock,
  computeAppChallengeHash,
  AppWithCounterClass,
  restore,
  snapshot,
  provider,
  sortSignaturesBySignerAddress,
} from "../utils";

import AppWithAction from "../../../build/AppWithAction.json";
import ChallengeRegistry from "../../../build/ChallengeRegistry.json";

describe("setState", () => {
  let wallet: Wallet;
  let snapshotId: number;

  let bob: Wallet;

  let appRegistry: Contract;
  let appDefinition: Contract;
  let ONCHAIN_CHALLENGE_TIMEOUT: number;
  let appInstance: AppWithCounterClass;

  let setState: (versionNumber: number, appState?: string, timeout?: number) => Promise<void>;
  let verifyChallenge: (expected: Partial<AppChallenge>) => Promise<void>;
  let verifyEmptyChallenge: () => Promise<void>;

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
    setState = context["setState"];
    verifyChallenge = context["verifyChallenge"];
    verifyEmptyChallenge = context["verifyEmptyChallenge"];
    ONCHAIN_CHALLENGE_TIMEOUT = context["ONCHAIN_CHALLENGE_TIMEOUT"];
    appInstance = context["appInstance"];
    bob = context["bob"];
  });

  afterEach(async () => {
    await restore(snapshotId);
  });

  describe("setState", () => {
    it("should work when a challenge is submitted for the first time", async () => {
      await verifyEmptyChallenge();

      const versionNumber = 3;
      const state = randomState();
      const timeout = 4;

      await setState(versionNumber, state, timeout);

      await verifyChallenge({
        status: ChallengeStatus.IN_DISPUTE,
        appStateHash: appStateToHash(state),
        versionNumber: toBN(versionNumber),
        finalizesAt: toBN((await provider.getBlockNumber()) + timeout),
      });
    });

    it("should work when a challenge with a higher version number is submmitted", async () => {
      const versionNumber = 3;
      const state = randomState();
      const timeout = 4;

      await setState(versionNumber, state, timeout);

      await verifyChallenge({
        status: ChallengeStatus.IN_DISPUTE,
        appStateHash: appStateToHash(state),
        versionNumber: toBN(versionNumber),
        finalizesAt: toBN((await provider.getBlockNumber()) + timeout),
      });

      const newVersionNumber = 10;
      const newState = randomState();
      const newTimeout = 2;

      await setState(newVersionNumber, newState, newTimeout);

      await verifyChallenge({
        status: ChallengeStatus.IN_DISPUTE,
        appStateHash: appStateToHash(newState),
        versionNumber: toBN(newVersionNumber),
        finalizesAt: toBN((await provider.getBlockNumber()) + newTimeout),
      });
    });

    it("fails if not disputable", async () => {
      const state = randomState();
      await setState(1, state);
      await verifyChallenge({
        status: ChallengeStatus.IN_DISPUTE,
        appStateHash: appStateToHash(state),
        versionNumber: toBN(1),
      });

      await moveToBlock(100);

      await expect(setState(2, randomState())).to.be.revertedWith(
        "setState was called on an app that cannot be disputed anymore",
      );
    });

    it("fails if incorrect signers", async () => {
      const state = randomState();
      const thingToSign = computeAppChallengeHash(
        appInstance.identityHash,
        appStateToHash(state),
        1, // version numner
        ONCHAIN_CHALLENGE_TIMEOUT, // timeout
      );
      await expect(
        appRegistry.functions.setState(appInstance.appIdentity, {
          versionNumber: One,
          appStateHash: appStateToHash(state),
          timeout: ONCHAIN_CHALLENGE_TIMEOUT,
          signatures: await sortSignaturesBySignerAddress(thingToSign, [
            await (new ChannelSigner(wallet.privateKey).signMessage(thingToSign)),
            await (new ChannelSigner(bob.privateKey).signMessage(thingToSign)),
          ]),
        }),
      ).to.be.revertedWith(`Invalid signature`);
    });

    it("fails if called with the same versioned state", async () => {
      const state = randomState();
      await setState(1, state);
      await verifyChallenge({
        status: ChallengeStatus.IN_DISPUTE,
        appStateHash: appStateToHash(state),
        versionNumber: toBN(1),
      });

      await expect(setState(1, state)).to.be.revertedWith(
        "setState was called with outdated state",
      );
    });

    it("fails if called with a stale state", async () => {
      const state = randomState();
      await setState(20, state);
      await verifyChallenge({
        status: ChallengeStatus.IN_DISPUTE,
        appStateHash: appStateToHash(state),
        versionNumber: toBN(20),
      });

      await expect(setState(1, state)).to.be.revertedWith(
        "setState was called with outdated state",
      );
    });
  });
});
