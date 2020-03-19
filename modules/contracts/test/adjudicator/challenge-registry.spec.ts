/* global before */
import { waffle as buidler } from "@nomiclabs/buidler";
import * as waffle from "ethereum-waffle";
import { Contract, Wallet } from "ethers";
import { AddressZero, HashZero } from "ethers/constants";
import {
  BigNumberish,
  hexlify,
  joinSignature,
  keccak256,
  randomBytes,
  SigningKey,
} from "ethers/utils";

import ChallengeRegistry from "../../build/ChallengeRegistry.json";
import {
  AppIdentityTestClass,
  randomState,
  appStateToHash,
  computeAppChallengeHash,
  expect,
  sortSignaturesBySignerAddress,
} from "./utils";

enum ChallengeStatus {
  NO_CHALLENGE,
  IN_DISPUTE,
  IN_ONCHAIN_PROGRESSION,
  EXPLICITLY_FINALIZED,
};

type Challenge = {
  status: ChallengeStatus;
  latestSubmitter: string;
  appStateHash: string;
  versionNumber: BigNumberish;
  finalizesAt: BigNumberish;
};

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

  let setStateWithSignatures: (
    versionNumber: BigNumberish,
    appState?: string,
    timeout?: number,
  ) => Promise<void>;
  let cancelChallenge: () => Promise<void>;
  let sendSignedFinalizationToChain: () => Promise<any>;
  let getChallenge: () => Promise<Challenge>;
  let latestAppStateHash: () => Promise<string>;
  let latestVersionNumber: () => Promise<BigNumberish>;
  let isStateFinalized: () => Promise<boolean>;
  let verifyChallenge: (expected: Challenge) => Promise<void>;
  let verifyEmptyChallenge: () => Promise<void>;
  let verifyVersionNumber: (expected: BigNumberish) => Promise<void>;

  before(async () => {
    wallet = (await provider.getWallets())[0];
    await wallet.getTransactionCount();

    appRegistry = await waffle.deployContract(wallet, ChallengeRegistry);
  });

  beforeEach(async () => {
    const appIdentityTestObject = new AppIdentityTestClass(
      [ALICE.address, BOB.address],
      hexlify(randomBytes(20)),
      10,
      globalChannelNonce,
    );

    globalChannelNonce += 1;

    getChallenge = () => appRegistry.functions.getAppChallenge(appIdentityTestObject.identityHash);

    latestAppStateHash = async () => (await getChallenge()).appStateHash;

    latestVersionNumber = async () => (await getChallenge()).versionNumber;

    isStateFinalized = async () =>
      await appRegistry.functions.isStateFinalized(appIdentityTestObject.identityHash);

    verifyChallenge = async (expected: Challenge) => {
      const {
        status,
        latestSubmitter,
        appStateHash,
        versionNumber,
        finalizesAt,
      } = await getChallenge();

      expect(status).to.be.eq(expected.status);
      expect(latestSubmitter).to.be.eq(expected.latestSubmitter);
      expect(appStateHash).to.be.eq(expected.appStateHash);
      expect(versionNumber).to.be.eq(expected.versionNumber);
      expect(finalizesAt).to.be.eq(expected.finalizesAt);
    };

    verifyEmptyChallenge = async () => {
      await verifyChallenge({
        status: ChallengeStatus.NO_CHALLENGE,
        latestSubmitter: AddressZero,
        appStateHash: HashZero,
        versionNumber: 0,
        finalizesAt: 0
      });
    };

    verifyVersionNumber = async (expectedVersionNumber: BigNumberish) => {
      const { versionNumber } = await getChallenge();
      expect(versionNumber).to.be.eq(expectedVersionNumber);
    }

    cancelChallenge = async () => {
      const digest = computeAppChallengeHash(
        appIdentityTestObject.identityHash,
        await latestAppStateHash(),
        await latestVersionNumber(),
        appIdentityTestObject.defaultTimeout,
      );

      await appRegistry.functions.cancelChallenge(
        appIdentityTestObject.appIdentity,
        sortSignaturesBySignerAddress(digest, [
          await new SigningKey(ALICE.privateKey).signDigest(digest),
          await new SigningKey(BOB.privateKey).signDigest(digest),
        ]).map(joinSignature),
      );
    };

    setStateWithSignatures = async (
      versionNumber: BigNumberish,
      appState: string = HashZero,
      timeout: number = ONCHAIN_CHALLENGE_TIMEOUT,
    ) => {
      const stateHash = keccak256(appState);
      const digest = computeAppChallengeHash(
        appIdentityTestObject.identityHash,
        stateHash,
        versionNumber,
        timeout,
      );
      await appRegistry.functions.setState(appIdentityTestObject.appIdentity, {
        timeout,
        versionNumber,
        appStateHash: stateHash,
        signatures: sortSignaturesBySignerAddress(digest, [
          await new SigningKey(ALICE.privateKey).signDigest(digest),
          await new SigningKey(BOB.privateKey).signDigest(digest),
        ]).map(joinSignature),
      });
    };

    /* TODO [OLD]: doesn't work currently
    sendSignedFinalizationToChain = async () =>
      await setStateWithSignatures(
        (await latestVersionNumber()) + 1,
        await latestAppStateHash(),
        0,
      );
    */
  });

  describe("setState -- happy case", () => {
    it("should work when a challenge is submitted for the first time", async () => {
      await verifyEmptyChallenge();

      const versionNumber = 3;
      const state = randomState();
      const timeout = 4;

      await setStateWithSignatures(versionNumber, state, timeout);

      await verifyChallenge({
        status: ChallengeStatus.IN_DISPUTE,
        latestSubmitter: await wallet.getAddress(),
        appStateHash: appStateToHash(state),
        versionNumber: versionNumber,
        finalizesAt: await provider.getBlockNumber() + timeout,
      });
    });

    it("should work when a challenge with a higher version number is submmitted", async () => {
      const versionNumber = 3;
      const state = randomState();
      const timeout = 4;

      await setStateWithSignatures(versionNumber, state, timeout);

      await verifyChallenge({
        status: ChallengeStatus.IN_DISPUTE,
        latestSubmitter: await wallet.getAddress(),
        appStateHash: appStateToHash(state),
        versionNumber: versionNumber,
        finalizesAt: await provider.getBlockNumber() + timeout,
      });

      const newVersionNumber = 4;
      const newState = randomState();
      const newTimeout = 2;

      await setStateWithSignatures(newVersionNumber, newState, newTimeout);

      await verifyChallenge({
        status: ChallengeStatus.IN_DISPUTE,
        latestSubmitter: await wallet.getAddress(),
        appStateHash: appStateToHash(newState),
        versionNumber: newVersionNumber,
        finalizesAt: await provider.getBlockNumber() + newTimeout,
      });
    });
  });

  // Old stuff
  describe("updating app state", () => {
    describe("with signing keys", async () => {
      it("should work with higher versionNumber", async () => {
        expect(await latestVersionNumber()).to.eq(0);
        await setStateWithSignatures(1);
        expect(await latestVersionNumber()).to.eq(1);
      });

      it("should work many times", async () => {
        expect(await latestVersionNumber()).to.eq(0);
        await setStateWithSignatures(1);
        expect(await latestVersionNumber()).to.eq(1);
        await cancelChallenge();
        await setStateWithSignatures(2);
        expect(await latestVersionNumber()).to.eq(2);
        await cancelChallenge();
        await setStateWithSignatures(3);
        expect(await latestVersionNumber()).to.eq(3);
      });

      it("should work with much higher versionNumber", async () => {
        expect(await latestVersionNumber()).to.eq(0);
        await setStateWithSignatures(1000);
        expect(await latestVersionNumber()).to.eq(1000);
      });

      it("shouldn't work with an equal versionNumber", async () => {
        await expect(setStateWithSignatures(0)).to.be.reverted;  // TODO: check revert message
        expect(await latestVersionNumber()).to.eq(0);
      });

      it("shouldn't work with a lower versionNumber", async () => {
        await setStateWithSignatures(1);
        await expect(setStateWithSignatures(0)).to.be.reverted;  // TODO: check revert message
        expect(await latestVersionNumber()).to.eq(1);
      });
    });
  });

  /* TODO [OLD]: doesn't work currently
  describe("finalizing app state", async () => {
    it("should work with keys", async () => {
      expect(await isStateFinalized()).to.be.false;
      await sendSignedFinalizationToChain();
      expect(await isStateFinalized()).to.be.true;
    });
  });
  */

  /* TODO [OLD]: doesn't work currently
  describe("waiting for timeout", async () => {
    it("should block updates after the timeout", async () => {
      expect(await isStateFinalized()).to.be.false;

      await setStateWithSignatures(1);

      for (let index = 0; index <= ONCHAIN_CHALLENGE_TIMEOUT + 1; index++) {
        await provider.send("evm_mine", []);
      }

      expect(await isStateFinalized()).to.be.true;

      await expect(setStateWithSignatures(2)).to.be.reverted;  // TODO: check revert message

      await expect(setStateWithSignatures(0)).to.be.reverted;  // TODO: check revert message
    });
  });
  */

});
