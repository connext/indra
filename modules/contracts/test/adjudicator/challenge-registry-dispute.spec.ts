/* global before */
import { waffle as buidler } from "@nomiclabs/buidler";
import { Contract, Wallet } from "ethers";
import { HashZero } from "ethers/constants";
import { bigNumberify, joinSignature, keccak256, SigningKey } from "ethers/utils";

import {
  AppIdentityTestClass,
  computeAppChallengeHash,
  encodeAppAction,
  encodeAppState,
  expect,
  signaturesToBytes,
  sortSignaturesBySignerAddress,
  deployRegistry,
  ONCHAIN_CHALLENGE_TIMEOUT,
  getIncrementCounterAction,
  getAppWithActionState,
  deployApp,
} from "./utils";

const ALICE =
  // 0xaeF082d339D227646DB914f0cA9fF02c8544F30b
  new Wallet("0x3570f77380e22f8dc2274d8fd33e7830cc2d29cf76804e8c21f4f7a6cc571d27");

const BOB =
  // 0xb37e49bFC97A948617bF3B63BC6942BB15285715
  new Wallet("0x4ccac8b1e81fb18a98bbaf29b9bfe307885561f71b76bd4680d7aec9d0ddfcfd");

const PRE_STATE = getAppWithActionState();

const ACTION = getIncrementCounterAction(bigNumberify(2));

describe("ChallengeRegistry Challenge", () => {
  let provider = buidler.provider;
  let wallet: Wallet;

  let appRegistry: Contract;
  let appDefinition: Contract;

  let setState: (versionNumber: number, appState?: string) => Promise<void>;
  let latestState: () => Promise<string>;
  let latestVersionNumber: () => Promise<number>;
  let respondToChallenge: (state: any, action: any, actionSig: any) => Promise<any>;

  before(async () => {
    wallet = (await provider.getWallets())[0];

    appRegistry = await deployRegistry(wallet);

    appDefinition = await deployApp(wallet);
  });

  beforeEach(async () => {
    const appInstance = new AppIdentityTestClass([ALICE.address, BOB.address], appDefinition.address, 10, 123456);

    latestState = async () => (await appRegistry.functions.getAppChallenge(appInstance.identityHash)).appStateHash;

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
        appStateHash: stateHash,
        signatures: sortSignaturesBySignerAddress(digest, [
          await new SigningKey(ALICE.privateKey).signDigest(digest),
          await new SigningKey(BOB.privateKey).signDigest(digest),
        ]).map(joinSignature),
        timeout: ONCHAIN_CHALLENGE_TIMEOUT,
        versionNumber,
      });
    };

    respondToChallenge = (state: any, action: any, actionSig: any) =>
      appRegistry.functions.respondToChallenge(
        appInstance.appIdentity,
        encodeAppState(state),
        encodeAppAction(action),
        actionSig,
      );
  });

  it("Can call respondToChallenge", async () => {
    expect(await latestVersionNumber()).to.eq(0);

    await setState(1, encodeAppState(PRE_STATE));

    expect(await latestVersionNumber()).to.eq(1);

    const signer = new SigningKey(BOB.privateKey);
    const thingToSign = keccak256(encodeAppAction(ACTION));
    const signature = await signer.signDigest(thingToSign);
    const bytes = signaturesToBytes(signature);

    expect(await latestState()).to.be.eql(keccak256(encodeAppState(PRE_STATE)));

    await respondToChallenge(PRE_STATE, ACTION, bytes);

    expect(await latestState()).to.be.eql(HashZero);
  });

  it("Cannot call respondToChallenge with incorrect turn taker", async () => {
    await setState(1, encodeAppState(PRE_STATE));

    const signer = new SigningKey(ALICE.privateKey);
    const thingToSign = keccak256(encodeAppAction(ACTION));
    const signature = await signer.signDigest(thingToSign);
    const bytes = signaturesToBytes(signature);

    await expect(respondToChallenge(PRE_STATE, ACTION, bytes)).to.be.revertedWith(
      "Action must have been signed by correct turn taker",
    );
  });
});
