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

  let latestTimeout: () => Promise<number>;
  let latestState: () => Promise<string>;
  let latestVersionNumber: () => Promise<number>;
  let setState: (versionNumber: number, appState?: string) => Promise<void>;
  let respondToChallenge: (state: any, action: any, actionSig: any) => Promise<any>;

  const mineBlocks = async (num: number) => {
    for (let i = 0; i < num; i++) {
      await provider.send("evm_mine", []);
      const block = await provider.getBlock('latest');
      const blockNumber = block.number;
      console.log(blockNumber);
    }
  }

  const getLatestBlockNumber = async () => (await provider.getBlock('latest')).number;

  /*
  const moveToBlock = async (blockNumber: number) => {
    let currentBlockNumber = await getLatestBlockNumber();
    expect(currentBlockNumber).to.be.lte(blockNumber - 1);
    console.log("Current block number: " + currentBlockNumber);
    while (currentBlockNumber < blockNumber - 1) {
      console.log("TRUE: " + currentBlockNumber + "<" + blockNumber);
      await provider.send("evm_mine", []);
      currentBlockNumber = await getLatestBlockNumber();
    }
    expect(currentBlockNumber).to.be.eq(blockNumber - 1);
  }
  */

  const moveToBlock = async (blockNumber: BigNumberish) => {
    const blockNumberBN: BigNumber = bigNumberify(blockNumber);
    let currentBlockNumberBN: BigNumber = bigNumberify(await getLatestBlockNumber());
    expect(currentBlockNumberBN).to.be.at.most(blockNumberBN.sub(1));
    console.log("Current block number: " + currentBlockNumberBN);
    while (currentBlockNumberBN.lt(blockNumberBN.sub(1))) {
      console.log("TRUE: " + currentBlockNumberBN + "<" + blockNumberBN);
      await provider.send("evm_mine", []);
      currentBlockNumberBN = bigNumberify(await getLatestBlockNumber());
    }
    expect(currentBlockNumberBN).to.be.equal(blockNumberBN.sub(1));
  }
  /*
  const moveToBlock = async (blockNumber: BigNumberish) => {
    let currentBlockNumber: BigNumberish = bigNumberify(await getLatestBlockNumber());
    //expect(currentBlockNumber).to.be.lte(blockNumber);
    console.log("Current block number: " + currentBlockNumber);
    while (currentBlockNumber.lt(blockNumber)) {
      await provider.send("evm_mine", []);
      currentBlockNumber = bigNumberify(await getLatestBlockNumber());
    }
    //expect(currentBlockNumber).to.be.eq(blockNumber);
  }
  */

  before(async () => {
    wallet = (await provider.getWallets())[0];
    await wallet.getTransactionCount();
  });

  beforeEach(async () => {
    const appRegistry = await waffle.deployContract(wallet, ChallengeRegistry);

    const appDefinition: Contract = await waffle.deployContract(wallet, AppWithAction);

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

    respondToChallenge = async (state: any, action: any, actionSig: any) => {
      await appRegistry.functions.respondToChallenge(
        appInstance.appIdentity,
        encodeState(state), {
          encodedAction: encodeAction(action),
          signature: actionSig,
        }
      );
    };
  });

  it("Can call respondToChallenge", async () => {
    expect(await latestVersionNumber()).to.eq(0);

    await setState(1, encodeState(PRE_STATE));

    expect(await latestVersionNumber()).to.eq(1);
    console.log("Block number: " +(await provider.getBlock('latest')).number);
    console.log("Timeout: " + (await latestTimeout()));

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
    console.log(await latestTimeout());

    /*
    for (let i = 0; i <= ONCHAIN_CHALLENGE_TIMEOUT + 3; i++) {
      const block = await provider.getBlock('latest');
      const blockNumber = block.number;
      console.log(blockNumber);
      await provider.send("evm_mine", []);
    }
    await mineBlocks(ONCHAIN_CHALLENGE_TIMEOUT-1);
    */

    await moveToBlock(33);
    console.log(await latestTimeout());

    console.log("END: " + (await provider.getBlock('latest')).number);
    await respondToChallenge(PRE_STATE, ACTION, bytes);
    console.log("END2: " + (await provider.getBlock('latest')).number);

    //expect(await latestState()).to.be.eql(HashZero);
    expect(await latestState()).to.be.eql(keccak256(encodeState(POST_STATE)));
  });

  it("Cannot call respondToChallenge with incorrect turn taker", async () => {
    await setState(1, encodeState(PRE_STATE));

    console.log("Block number: " +(await provider.getBlock('latest')).number);
    const signer = new SigningKey(ALICE.privateKey);
    const thingToSign = computeActionHash(
      BOB.address,
      keccak256(encodeState(PRE_STATE)),
      encodeAction(ACTION),
      1
    );
    const signature = await signer.signDigest(thingToSign);
    const bytes = signaturesToBytes(signature);

    await moveToBlock(66);
    await expect(respondToChallenge(PRE_STATE, ACTION, bytes)).to.be.revertedWith(
      "respondToChallenge called with action signed by incorrect turn taker",
    );
  });
});
