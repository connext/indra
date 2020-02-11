import { AppIdentity, Contract } from "@connext/types";
import * as chai from "chai";
import * as waffle from "ethereum-waffle";
import {
  BigNumber,
  BigNumberish,
  defaultAbiCoder,
  joinSignature,
  keccak256,
  recoverAddress,
  Signature,
  SigningKey,
  solidityPack,
} from "ethers/utils";
import { Wallet } from "ethers";
import { HashZero } from "ethers/constants";
import { Web3Provider } from "ethers/providers";

import ChallengeRegistry from "../../../build/ChallengeRegistry.json";
import AppWithAction from "../../../build/AppWithAction.json";

chai.use(require("chai-subset"));
chai.use(waffle.solidity);
export const expect = chai.expect;

// HELPER DATA
export const ONCHAIN_CHALLENGE_TIMEOUT = 30;

export enum ChallengeStatus {
  NO_CHALLENGE,
  FINALIZES_AFTER_DEADLINE,
  EXPLICITLY_FINALIZED,
  OUTCOME_SET,
}

export type Challenge = {
  status: ChallengeStatus;
  latestSubmitter: string;
  appStateHash: string;
  challengeCounter: BigNumber;
  finalizesAt: BigNumber;
  versionNumber: BigNumber;
};

// TS version of MChallengeRegistryCore::computeAppChallengeHash
export const computeAppChallengeHash = (
  id: string,
  appStateHash: string,
  versionNumber: BigNumberish,
  timeout: BigNumberish,
) =>
  keccak256(
    solidityPack(
      ["bytes1", "bytes32", "uint256", "uint256", "bytes32"],
      ["0x19", id, versionNumber, timeout, appStateHash],
    ),
  );

// TS version of MChallengeRegistryCore::computeActionHash
export const computeActionHash = (turnTaker: string, previousState: string, action: string, versionNumber: number) =>
  keccak256(
    solidityPack(
      ["bytes1", "address", "bytes", "bytes", "uint256"],
      ["0x19", turnTaker, previousState, action, versionNumber],
    ),
  );

export class AppIdentityTestClass {
  get identityHash(): string {
    return keccak256(defaultAbiCoder.encode(["uint256", "address[]"], [this.channelNonce, this.participants]));
  }

  get appIdentity(): AppIdentity {
    return {
      appDefinition: this.appDefinition,
      channelNonce: this.channelNonce,
      defaultTimeout: this.defaultTimeout,
      participants: this.participants,
    };
  }

  constructor(
    readonly participants: string[],
    readonly appDefinition: string,
    readonly defaultTimeout: number,
    readonly channelNonce: number,
  ) {}
}

/**
 * Converts an array of signatures into a single string
 *
 * @param signatures An array of etherium signatures
 */
export function signaturesToBytes(...signatures: Signature[]): string {
  return signatures
    .map(joinSignature)
    .map(s => s.substr(2))
    .reduce((acc, v) => acc + v, "0x");
}

/**
 * Sorts signatures in ascending order of signer address
 *
 * @param signatures An array of etherium signatures
 */
export function sortSignaturesBySignerAddress(digest: string, signatures: Signature[]): Signature[] {
  const ret = signatures.slice();
  ret.sort((sigA, sigB) => {
    const addrA = recoverAddress(digest, signaturesToBytes(sigA));
    const addrB = recoverAddress(digest, signaturesToBytes(sigB));
    return new BigNumber(addrA).lt(addrB) ? -1 : 1;
  });
  return ret;
}

/**
 * Sorts signatures in ascending order of signer address
 * and converts them into bytes
 *
 * @param signatures An array of etherium signatures
 */
export function signaturesToBytesSortedBySignerAddress(digest: string, ...signatures: Signature[]): string {
  return signaturesToBytes(...sortSignaturesBySignerAddress(digest, signatures));
}

/**
 * Returns a challenge
 */
export async function getChallenge(identityHash: string, challengeRegistry: Contract): Promise<Challenge> {
  const [
    status,
    latestSubmitter,
    appStateHash,
    challengeCounter,
    versionNumber,
    finalizesAt,
  ] = await challengeRegistry.functions.getAppChallenge(identityHash);
  return {
    appStateHash,
    challengeCounter,
    finalizesAt,
    latestSubmitter,
    status,
    versionNumber,
  };
}

/**
 * Returns latest app state hash
 */
export async function latestAppStateHash(identityHash: string, challengeRegistry: Contract): Promise<string> {
  const { appStateHash } = await getChallenge(identityHash, challengeRegistry);
  return appStateHash;
}

/**
 * Returns latest app version number
 */
export async function latestVersionNumber(identityHash: string, challengeRegistry: Contract): Promise<BigNumber> {
  const { versionNumber } = await getChallenge(identityHash, challengeRegistry);
  return versionNumber;
}

/**
 * Returns whether or not the state is finalized
 */
export async function isStateFinalized(identityHash: string, challengeRegistry: Contract): Promise<boolean> {
  return await challengeRegistry.functions.isStateFinalized(identityHash);
}

/**
 * Returns whether or not the outcome is set
 */
export async function isOutcomeSet(identityHash: string, challengeRegistry: Contract): Promise<boolean> {
  return await challengeRegistry.functions.isOutcomeSet(identityHash);
}

/**
 * Returns the outcome if it is set
 */
export async function getOutcome(identityHash: string, challengeRegistry: Contract): Promise<boolean> {
  return await challengeRegistry.functions.getOutcome(identityHash);
}

/**
 * Sets the state in the challenge registry
 */
export async function setStateWithSignatures(
  appIdentity: AppIdentityTestClass,
  participants: Wallet[],
  challengeRegistry: Contract,
  versionNumber: BigNumberish,
  appState: string = HashZero,
  timeout: BigNumberish = ONCHAIN_CHALLENGE_TIMEOUT,
): Promise<void> {
  const stateHash = keccak256(appState);
  const digest = computeAppChallengeHash(appIdentity.identityHash, stateHash, versionNumber, timeout);
  expect(participants.length).to.be.eq(2);
  await challengeRegistry.functions.setState(appIdentity.appIdentity, {
    appStateHash: stateHash,
    signatures: sortSignaturesBySignerAddress(digest, [
      await new SigningKey(participants[0].privateKey).signDigest(digest),
      await new SigningKey(participants[1].privateKey).signDigest(digest),
    ]).map(joinSignature),
    timeout,
    versionNumber,
  });
}

export async function setOutcome(
  appIdentity: AppIdentityTestClass,
  challengeRegistry: Contract,
  finalState: string = HashZero,
): Promise<void> {
  await challengeRegistry.functions.setOutcome(appIdentity, finalState);
}

/**
 * Cancels an active challenge
 */
export async function cancelChallenge(
  participants: Wallet[],
  appIdentity: AppIdentityTestClass,
  challengeRegistry: Contract,
): Promise<void> {
  const digest = computeAppChallengeHash(
    appIdentity.identityHash,
    await latestAppStateHash(appIdentity.identityHash, challengeRegistry),
    await latestVersionNumber(appIdentity.identityHash, challengeRegistry),
    appIdentity.defaultTimeout,
  );

  expect(participants.length).to.be.eq(2);
  await challengeRegistry.functions.cancelChallenge(
    appIdentity.appIdentity,
    sortSignaturesBySignerAddress(digest, [
      await new SigningKey(participants[0].privateKey).signDigest(digest),
      await new SigningKey(participants[1].privateKey).signDigest(digest),
    ]).map(joinSignature),
  );
}

/**
 * Fast forwards blocks + 1 from current block
 * @param provider
 * @param blocks
 */
export async function advanceBlocks(provider: Web3Provider, blocks: number = ONCHAIN_CHALLENGE_TIMEOUT + 1) {
  const currBlock = await provider.getBlockNumber();
  for (const _ of Array(blocks)) {
    await provider.send("evm_mine", []);
  }
  expect(await provider.getBlockNumber()).to.be.equal(currBlock + blocks);
}

/**
 * Deploys the `ChallengeRegistry.sol`
 * @param wallet default interacting wallet
 */
export async function deployRegistry(wallet: Wallet): Promise<Contract> {
  return await waffle.deployContract(wallet, ChallengeRegistry, [], {
    gasLimit: 6000000, // override default of 4 million
  });
}

/**
 * Deploys the `ChallengeRegistry.sol`
 * @param wallet default interacting wallet
 */
export async function deployApp(wallet: Wallet): Promise<Contract> {
  return await waffle.deployContract(wallet, AppWithAction, [], {
    gasLimit: 6000000, // override default of 4 million
  });
}
