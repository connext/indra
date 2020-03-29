/* global before */
import { waffle as buidler } from "@nomiclabs/buidler";
import { SolidityValueType, sortSignaturesBySignerAddress, ChallengeStatus, AppChallengeBigNumber } from "@connext/types";
import { signDigest } from "@connext/crypto";
import * as waffle from "ethereum-waffle";
import { Contract, Wallet } from "ethers";
import { HashZero, AddressZero, Zero, One } from "ethers/constants";
import { BigNumber, BigNumberish, bigNumberify, defaultAbiCoder, keccak256 } from "ethers/utils";

import AppWithAction from "../../build/AppWithAction.json";
import ChallengeRegistry from "../../build/ChallengeRegistry.json";

import { AppIdentityTestClass, computeAppChallengeHash, expect, computeActionHash, AppWithCounterState, AppWithCounterAction, ActionType } from "./utils";

const ALICE =
  // 0xaeF082d339D227646DB914f0cA9fF02c8544F30b
  new Wallet("0x3570f77380e22f8dc2274d8fd33e7830cc2d29cf76804e8c21f4f7a6cc571d27");

const BOB =
  // 0xb37e49bFC97A948617bF3B63BC6942BB15285715
  new Wallet("0x4ccac8b1e81fb18a98bbaf29b9bfe307885561f71b76bd4680d7aec9d0ddfcfd");

// HELPER DATA
const ONCHAIN_CHALLENGE_TIMEOUT = 30;
const DEFAULT_TIMEOUT = 10;

const PRE_STATE: AppWithCounterState = {
  counter: bigNumberify(0),
};

const POST_STATE: AppWithCounterState = {
  counter: bigNumberify(2),
};

const ACTION: AppWithCounterAction = {
  actionType: ActionType.SUBMIT_COUNTER_INCREMENT,
  increment: bigNumberify(2),
};

function encodeState(state: SolidityValueType) {
  return defaultAbiCoder.encode([`tuple(uint256 counter)`], [state]);
}

function encodeAction(action: SolidityValueType) {
  return defaultAbiCoder.encode([`tuple(uint8 actionType, uint256 increment)`], [action]);
}

describe.only("progressState", () => {
  let provider = buidler.provider;
  let wallet: Wallet;

  let appRegistry: Contract;
  let appDefinition: Contract;

  let snapshotId: any;

  let setState: (versionNumber: number, appState?: string) => Promise<void>;
  let getChallenge: () => Promise<AppChallengeBigNumber>;
  let progressState: (state: AppWithCounterState, action: AppWithCounterAction, actionSig: string) => Promise<void>;
  let verifyChallenge: (expected: Partial<AppChallengeBigNumber>) => Promise<void>;
  let isProgressable: () => Promise<boolean>;
  let progressStateAndVerify: (state: AppWithCounterState, action: AppWithCounterAction, signer?: Wallet) => Promise<void>;

  const mineBlock = async () => await provider.send("evm_mine", []);
  const snapshot = async () => await provider.send("evm_snapshot", []);
  const restore = async (snapshotId: any) => await provider.send("evm_revert", [snapshotId]);

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
  };

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
      DEFAULT_TIMEOUT, // default timeout
      123456, // channel nonce
    );

    getChallenge = async (): Promise<AppChallengeBigNumber> => {
      const [
        status, 
        latestSubmitter,
        appStateHash,
        versionNumber,
        finalizesAt,
      ] = await appRegistry.functions.getAppChallenge(appInstance.identityHash);
      return {
        status,
        latestSubmitter,
        appStateHash,
        versionNumber,
        finalizesAt,
      };
    };

    verifyChallenge = async (expected: Partial<AppChallengeBigNumber>) => {
      const challenge = await getChallenge();
      expect(challenge).to.containSubset(expected);
    };

    isProgressable = async () => {
      const challenge = await appRegistry.functions.getAppChallenge(appInstance.identityHash); 
      return await appRegistry.functions.isProgressable(challenge, appInstance.defaultTimeout);
    };

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
        signatures: await sortSignaturesBySignerAddress(digest, [
          await signDigest(ALICE.privateKey, digest),
          await signDigest(BOB.privateKey, digest),
        ]),
      });
    };

    progressStateAndVerify = async (state: AppWithCounterState, action: AppWithCounterAction, signer: Wallet = BOB): Promise<void> => {
      const existingChallenge = await getChallenge();
      const thingToSign = computeActionHash(
        signer.address,
        keccak256(encodeState(state)),
        encodeAction(action),
        existingChallenge.versionNumber.toNumber(),
      );
      const signature = await signDigest(signer.privateKey, thingToSign);
      expect(await isProgressable()).to.be.true;
      const resultingState: AppWithCounterState = {
        counter: action.actionType === ActionType.ACCEPT_INCREMENT
          ? state.counter
          : state.counter.add(action.increment),
      };
      const expected: AppChallengeBigNumber = {
        latestSubmitter: wallet.address,
        appStateHash: keccak256(encodeState(resultingState)),
        versionNumber: existingChallenge.versionNumber.add(One),
        finalizesAt: existingChallenge.finalizesAt.add(DEFAULT_TIMEOUT),
        status: ChallengeStatus.IN_ONCHAIN_PROGRESSION,
      };
      await progressState(state, action, signature);
      await verifyChallenge(expected);
      expect(await isProgressable()).to.be.true;
    };

    progressState = async (state: AppWithCounterState, action: AppWithCounterAction, actionSig: string) => {
      await appRegistry.functions.progressState(
        appInstance.appIdentity,
        encodeState(state),
        {
          encodedAction: encodeAction(action),
          signature: actionSig,
        },
      );
    };
  });

  afterEach(async () => {
    await restore(snapshotId);
  });

  it("Can call progressState", async () => {
    const empty = {
      latestSubmitter: AddressZero,
      versionNumber: Zero,
      appStateHash: HashZero,
      status: ChallengeStatus.NO_CHALLENGE,
      finalizesAt: Zero,
    };
    await verifyChallenge(empty);

    const originalChallenge = {
      latestSubmitter: wallet.address,
      versionNumber: One,
      appStateHash: keccak256(encodeState(PRE_STATE)),
      status: ChallengeStatus.IN_DISPUTE,
    };
    await setState(1, encodeState(PRE_STATE));
    await verifyChallenge(originalChallenge);

    expect(await isProgressable()).to.be.false;
    await moveToBlock(33);
    await progressStateAndVerify(PRE_STATE, ACTION);
  });

  it("Can be called multiple times", async () => {
    await setState(1, encodeState(PRE_STATE));

    const expected = {
      latestSubmitter: wallet.address,
      versionNumber: One,
      appStateHash: keccak256(encodeState(PRE_STATE)),
      status: ChallengeStatus.IN_DISPUTE,
    };
    await verifyChallenge(expected);

    expect(await isProgressable()).to.be.false;
    await moveToBlock(33);
    await progressStateAndVerify(PRE_STATE, ACTION);

    const thingToSign2 = computeActionHash(
      ALICE.address,
      keccak256(encodeState(POST_STATE)),
      encodeAction(ACTION),
      2,
    );
    const signature2 = await signDigest(ALICE.privateKey, thingToSign2);
    await progressState(POST_STATE, ACTION, signature2);
  });

  it("Cannot call progressState with incorrect turn taker", async () => {
    await setState(1, encodeState(PRE_STATE));

    await moveToBlock(33);

    await expect(progressStateAndVerify(PRE_STATE, ACTION, ALICE)).to.be.revertedWith(
      "progressState called with action signed by incorrect turn taker",
    );
  });

  it("progressState should fail if incorrect state submitted", async () => {
    await setState(1, encodeState(PRE_STATE));

    await moveToBlock(33);

    await expect(progressStateAndVerify(POST_STATE, ACTION)).to.be.revertedWith(
      "Tried to progress a challenge with non-agreed upon app",
    );
  });

  it("progressState should fail if dispute is not progressable", async () => {
    await setState(1, encodeState(PRE_STATE));

    const thingToSign = computeActionHash(
      BOB.address,
      keccak256(encodeState(PRE_STATE)),
      encodeAction(ACTION),
      1,
    );
    const signature = await signDigest(ALICE.privateKey, thingToSign);

    expect(await isProgressable()).to.be.false;
    await expect(progressState(POST_STATE, ACTION, signature)).to.be.revertedWith(
      "progressState called on app not in a progressable state",
    );
  });

  it("progressState should fail if apply action fails", async () => {
    // TODO: how to make sure the action is invalid?
  });

});
