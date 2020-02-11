/* global before */
import { waffle as buidler } from "@nomiclabs/buidler";
import * as waffle from "ethereum-waffle";
import { Contract, Wallet } from "ethers";
import { Web3Provider } from "ethers/providers";
import { hexlify, keccak256, randomBytes, BigNumberish } from "ethers/utils";

import {
  AppIdentityTestClass,
  cancelChallenge,
  expect,
  getChallenge,
  isStateFinalized,
  latestAppStateHash,
  latestVersionNumber,
  setStateWithSignatures,
  deployRegistry,
  advanceBlocks,
} from "./utils";
import { HashZero } from "ethers/constants";

const ALICE =
  // 0xaeF082d339D227646DB914f0cA9fF02c8544F30b
  new Wallet("0x3570f77380e22f8dc2274d8fd33e7830cc2d29cf76804e8c21f4f7a6cc571d27");

const BOB =
  // 0xb37e49bFC97A948617bF3B63BC6942BB15285715
  new Wallet("0x4ccac8b1e81fb18a98bbaf29b9bfe307885561f71b76bd4680d7aec9d0ddfcfd");

// HELPER DATA
const ONCHAIN_CHALLENGE_TIMEOUT = 30;

describe("ChallengeRegistry", () => {
  let provider = buidler.provider;
  let wallet: Wallet;
  let globalChannelNonce = 0;

  let appRegistry: Contract;
  let appIdentityTestObject: AppIdentityTestClass;

  let sendSignedFinalizationToChain: () => Promise<any>;
  let setStateWithSigs: (versionNumber: BigNumberish, appState?: string, timeout?: number) => Promise<void>;

  before(async () => {
    wallet = (await provider.getWallets())[0];

    appRegistry = await deployRegistry(wallet);
  });

  beforeEach(async () => {
    appIdentityTestObject = new AppIdentityTestClass(
      [ALICE.address, BOB.address],
      hexlify(randomBytes(20)),
      10,
      globalChannelNonce,
    );

    globalChannelNonce += 1;

    setStateWithSigs = async (
      versionNumber: BigNumberish,
      appState: string = HashZero,
      timeout: number = ONCHAIN_CHALLENGE_TIMEOUT,
    ): Promise<void> => {
      return await setStateWithSignatures(
        appIdentityTestObject,
        [ALICE, BOB],
        appRegistry,
        versionNumber,
        appState,
        timeout,
      );
    };

    sendSignedFinalizationToChain = async () =>
      await setStateWithSigs(
        (await latestVersionNumber(appIdentityTestObject.identityHash, appRegistry)).add(1),
        await latestAppStateHash(appIdentityTestObject.identityHash, appRegistry),
        0,
      );
  });

  describe("updating app state", () => {
    describe("with signing keys", async () => {
      it("should work with higher versionNumber", async () => {
        expect(await latestVersionNumber(appIdentityTestObject.identityHash, appRegistry)).to.eq(0);
        await setStateWithSigs(1);
        expect(await latestVersionNumber(appIdentityTestObject.identityHash, appRegistry)).to.eq(1);
      });

      it("should work many times", async () => {
        expect(await latestVersionNumber(appIdentityTestObject.identityHash, appRegistry)).to.eq(0);
        await setStateWithSigs(1);
        expect(await latestVersionNumber(appIdentityTestObject.identityHash, appRegistry)).to.eq(1);
        await cancelChallenge([ALICE, BOB], appIdentityTestObject, appRegistry);
        await setStateWithSigs(2);
        expect(await latestVersionNumber(appIdentityTestObject.identityHash, appRegistry)).to.eq(2);
        await cancelChallenge([ALICE, BOB], appIdentityTestObject, appRegistry);
        await setStateWithSigs(3);
        expect(await latestVersionNumber(appIdentityTestObject.identityHash, appRegistry)).to.eq(3);
      });

      it("should work with much higher versionNumber", async () => {
        expect(await latestVersionNumber(appIdentityTestObject.identityHash, appRegistry)).to.eq(0);
        await setStateWithSigs(1000);
        expect(await latestVersionNumber(appIdentityTestObject.identityHash, appRegistry)).to.eq(1000);
      });

      it("shouldn't work with an equal versionNumber", async () => {
        await expect(setStateWithSigs(0)).to.be.reverted;
        expect(await latestVersionNumber(appIdentityTestObject.identityHash, appRegistry)).to.eq(0);
      });

      it("shouldn't work with a lower versionNumber", async () => {
        await setStateWithSigs(1);
        await expect(setStateWithSigs(0)).to.be.reverted;
        expect(await latestVersionNumber(appIdentityTestObject.identityHash, appRegistry)).to.eq(1);
      });
    });
  });

  describe("finalizing app state", async () => {
    it("should work with keys", async () => {
      expect(await isStateFinalized(appIdentityTestObject.identityHash, appRegistry)).to.be.false;
      await sendSignedFinalizationToChain();
      expect(await isStateFinalized(appIdentityTestObject.identityHash, appRegistry)).to.be.true;
    });
  });

  describe("waiting for timeout", async () => {
    it("should block updates after the timeout", async () => {
      expect(await isStateFinalized(appIdentityTestObject.identityHash, appRegistry)).to.be.false;

      await setStateWithSigs(1);

      await advanceBlocks(provider);

      expect(await isStateFinalized(appIdentityTestObject.identityHash, appRegistry)).to.be.true;

      await expect(setStateWithSigs(2)).to.be.reverted;

      await expect(setStateWithSigs(0)).to.be.reverted;
    });
  });

  it("is possible to call setState to put state on-chain", async () => {
    // Tell the ChallengeRegistry to start timer
    const state = hexlify(randomBytes(32));

    await setStateWithSigs(1, state);

    // Verify the correct data was put on-chain
    const { status, latestSubmitter, appStateHash, challengeCounter, finalizesAt, versionNumber } = await getChallenge(
      appIdentityTestObject.identityHash,
      appRegistry,
    );

    expect(status).to.be.eq(1);
    expect(latestSubmitter).to.be.eq(await wallet.getAddress());
    expect(appStateHash).to.be.eq(keccak256(state));
    expect(challengeCounter).to.be.eq(1);
    expect(finalizesAt).to.be.eq((await provider.getBlockNumber()) + ONCHAIN_CHALLENGE_TIMEOUT);
    expect(versionNumber).to.be.eq(1);
  });
});
