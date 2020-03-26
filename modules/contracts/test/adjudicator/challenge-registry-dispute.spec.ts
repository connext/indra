/* global before */
import { waffle as buidler } from "@nomiclabs/buidler";
import { SolidityValueType } from "@connext/types";
import * as waffle from "ethereum-waffle";
import { Contract, Wallet } from "ethers";
import { HashZero } from "ethers/constants";
import { BigNumber, BigNumberish, bigNumberify, defaultAbiCoder, joinSignature, keccak256, SigningKey } from "ethers/utils";

import AppWithAction from "../../build/AppWithAction.json";
import ChallengeRegistry from "../../build/ChallengeRegistry.json";

import {
  expect,
  computeAppChallengeHash,
  computeActionHash,
  AppIdentityTestClass,
  signaturesToBytes,
  sortSignaturesBySignerAddress,
} from "./utils";

enum ActionType {
  SUBMIT_COUNTER_INCREMENT,
  ACCEPT_INCREMENT,
}

const ALICE =
  // 0xaeF082d339D227646DB914f0cA9fF02c8544F30b
  new Wallet("0x3570f77380e22f8dc2274d8fd33e7830cc2d29cf76804e8c21f4f7a6cc571d27");

const BOB =
  // 0xb37e49bFC97A948617bF3B63BC6942BB15285715
  new Wallet("0x4ccac8b1e81fb18a98bbaf29b9bfe307885561f71b76bd4680d7aec9d0ddfcfd");

// HELPER DATA
const ONCHAIN_CHALLENGE_TIMEOUT = 30;

const PRE_STATE = {
  counter: bigNumberify(0),
};

const POST_STATE = {
  counter: bigNumberify(2),
};

const ACTION = {
  actionType: ActionType.SUBMIT_COUNTER_INCREMENT,
  increment: bigNumberify(2),
};

function encodeState(state: SolidityValueType) {
  return defaultAbiCoder.encode([`tuple(uint256 counter)`], [state]);
}

function encodeAction(action: SolidityValueType) {
  return defaultAbiCoder.encode([`tuple(uint8 actionType, uint256 increment)`], [action]);
}

describe("ChallengeRegistry Challenge", () => {
  let provider = buidler.provider;
  let wallet: Wallet;

  let appRegistry: Contract;
  let appDefinition: Contract;

  let snapshotId: any;

  let latestTimeout: () => Promise<number>;
  let latestState: () => Promise<string>;
  let latestVersionNumber: () => Promise<number>;
  let setState: (versionNumber: number, appState?: string) => Promise<void>;
  let progressState: (state: any, action: any, actionSig: any) => Promise<any>;

  const mineBlock = async () => await provider.send('evm_mine', []);
  const snapshot = async () => await provider.send('evm_snapshot', []);
  const restore = async (snapshotId: any) => await provider.send('evm_revert', [snapshotId]);

  const mineBlocks = async (num: number) => {
    for (let i = 0; i < num; i++) {
      await mineBlock();
    }
  }

  // TODO: Not sure this works correctly/reliably...
  const moveToBlock = async (blockNumber: BigNumberish) => {
    const blockNumberBN: BigNumber = bigNumberify(blockNumber);
    let currentBlockNumberBN: BigNumber = bigNumberify(await provider.getBlockNumber());
    expect(currentBlockNumberBN).to.be.at.most(blockNumberBN);
    while (currentBlockNumberBN.lt(blockNumberBN)) {
      await mineBlock();
      currentBlockNumberBN = bigNumberify(await provider.getBlockNumber());
    }
    expect(currentBlockNumberBN).to.be.equal(blockNumberBN);
  }

  before(async () => {
    wallet = (await provider.getWallets())[0];
    await wallet.getTransactionCount();

    appRegistry = await waffle.deployContract(wallet, ChallengeRegistry);

    appDefinition = await waffle.deployContract(wallet, AppWithAction);
  });

  beforeEach(async () => {
    snapshotId = await snapshot();

    const appInstance = new AppIdentityTestClass(
      [ALICE.address, BOB.address],
      appDefinition.address,
      10,
      123456,
    );

    latestTimeout = async () =>
      (await appRegistry.functions.getAppChallenge(appInstance.identityHash)).finalizesAt;

    latestState = async () =>
      (await appRegistry.functions.getAppChallenge(appInstance.identityHash)).appStateHash;

    latestVersionNumber = async () =>
      (await appRegistry.functions.getAppChallenge(appInstance.identityHash)).versionNumber;

    setState = async (versionNumber: number, appState?: string) => {
      const stateHash = keccak256(appState || HashZero);
      const digest = computeAppChallengeHash(
        appInstance.identityHash,
        stateHash,
        versionNumber,
        ONCHAIN_CHALLENGE_TIMEOUT,
      );
      await appRegistry.functions.setState(appInstance.appIdentity, {
        versionNumber,
        appStateHash: stateHash,
        timeout: ONCHAIN_CHALLENGE_TIMEOUT,
        signatures: sortSignaturesBySignerAddress(digest, [
          await new SigningKey(ALICE.privateKey).signDigest(digest),
          await new SigningKey(BOB.privateKey).signDigest(digest),
        ]).map(joinSignature),
      });
    };

    progressState = async (state: any, action: any, actionSig: any) => {
      await appRegistry.functions.progressState(
        appInstance.appIdentity,

        encodeState(state), {
          encodedAction: encodeAction(action),
          signature: actionSig,
        }
      );
    };
  });

  afterEach(async () => {
    await restore(snapshotId)
  })

  // WIP -- TODO: more comprehensive verification
  it("Can call progressState", async () => {
    expect(await latestVersionNumber()).to.eq(0);

    await setState(1, encodeState(PRE_STATE));

    expect(await latestVersionNumber()).to.eq(1);

    const signer = new SigningKey(BOB.privateKey);
    const thingToSign = computeActionHash(
      BOB.address,
      keccak256(encodeState(PRE_STATE)),
      encodeAction(ACTION),
      1
    );
    const signature = await signer.signDigest(thingToSign);
    const bytes = signaturesToBytes(signature);

    expect(await latestState()).to.be.eql(keccak256(encodeState(PRE_STATE)));

    await moveToBlock(33);

    await progressState(PRE_STATE, ACTION, bytes);

    expect(await latestState()).to.be.eql(keccak256(encodeState(POST_STATE)));
  });

  it("Cannot call progressState with incorrect turn taker", async () => {
    expect(await latestVersionNumber()).to.eq(0);

    await setState(1, encodeState(PRE_STATE));

    expect(await latestVersionNumber()).to.eq(1);

    const signer = new SigningKey(ALICE.privateKey);
    const thingToSign = computeActionHash(
      BOB.address,
      keccak256(encodeState(PRE_STATE)),
      encodeAction(ACTION),
      1
    );
    const signature = await signer.signDigest(thingToSign);
    const bytes = signaturesToBytes(signature);

    await moveToBlock(33);

    await expect(progressState(PRE_STATE, ACTION, bytes)).to.be.revertedWith(
      "progressState called with action signed by incorrect turn taker",
    );
  });
});
