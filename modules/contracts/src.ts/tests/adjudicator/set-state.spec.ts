import { AppChallenge, ChallengeStatus } from "@connext/types";
import {
  ChannelSigner,
  appStateToHash,
  computeAppChallengeHash,
  getRandomBytes32,
  toBN,
} from "@connext/utils";
import { Contract, Wallet, constants } from "ethers";

import { setupContext } from "../context";
import {
  AppWithCounterClass,
  expect,
  mineBlocks,
  provider,
  restore,
  snapshot,
  sortSignaturesBySignerAddress,
} from "../utils";

const { One } = constants;

describe("setState", () => {
  let wallet: Wallet;

  let bob: Wallet;
  let appRegistry: Contract;

  let ONCHAIN_CHALLENGE_TIMEOUT: number;
  let appInstance: AppWithCounterClass;

  let setState: (versionNumber: number, appState?: string, timeout?: number) => Promise<void>;
  let verifyChallenge: (expected: Partial<AppChallenge>) => Promise<void>;
  let verifyEmptyChallenge: () => Promise<void>;

  before(async () => {
    wallet = (await provider.getWallets())[0];
    await wallet.getTransactionCount();
  });

  beforeEach(async () => {
    const context = await setupContext();
    appRegistry = context["appRegistry"];
    setState = context["setState"];
    verifyChallenge = context["verifyChallenge"];
    verifyEmptyChallenge = context["verifyEmptyChallenge"];
    ONCHAIN_CHALLENGE_TIMEOUT = context["ONCHAIN_CHALLENGE_TIMEOUT"];
    appInstance = context["appInstance"];
    bob = context["bob"];
  });

  describe("setState", () => {
    it("should work when a challenge is submitted for the first time", async () => {
      await verifyEmptyChallenge();

      const versionNumber = 3;
      const state = getRandomBytes32();
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
      const state = getRandomBytes32();
      const timeout = 4;

      await setState(versionNumber, state, timeout);

      await verifyChallenge({
        status: ChallengeStatus.IN_DISPUTE,
        appStateHash: appStateToHash(state),
        versionNumber: toBN(versionNumber),
        finalizesAt: toBN((await provider.getBlockNumber()) + timeout),
      });

      const newVersionNumber = 10;
      const newState = getRandomBytes32();
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
      const state = getRandomBytes32();
      await setState(1, state);
      await verifyChallenge({
        status: ChallengeStatus.IN_DISPUTE,
        appStateHash: appStateToHash(state),
        versionNumber: toBN(1),
      });

      await mineBlocks(100);

      await expect(setState(2, getRandomBytes32())).to.be.revertedWith(
        "setState was called on an app that cannot be disputed anymore",
      );
    });

    it("fails if incorrect signers", async () => {
      const state = getRandomBytes32();
      const thingToSign = computeAppChallengeHash(
        appInstance.identityHash,
        appStateToHash(state),
        1, // version numner
        ONCHAIN_CHALLENGE_TIMEOUT, // timeout
      );
      await expect(
        appRegistry.setState(appInstance.appIdentity, {
          versionNumber: One,
          appStateHash: appStateToHash(state),
          timeout: ONCHAIN_CHALLENGE_TIMEOUT,
          signatures: await sortSignaturesBySignerAddress(thingToSign, [
            await new ChannelSigner(wallet.privateKey).signMessage(thingToSign),
            await new ChannelSigner(bob.privateKey).signMessage(thingToSign),
          ]),
        }),
      ).to.be.revertedWith(`Invalid signature`);
    });

    it("fails if called with the same versioned state", async () => {
      const state = getRandomBytes32();
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
      const state = getRandomBytes32();
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
