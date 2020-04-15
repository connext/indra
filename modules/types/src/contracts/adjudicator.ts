import { Address, HexString } from "../basic";
import { BigNumber } from "ethers/utils";
import { enumify } from "../utils";

////////////////////////////////////////
// keep synced w contracts/adjudicator/libs/LibStateChannelApp.sol

// A minimal structure that uniquely identifies a single instance of an App
export type AppIdentity<T = string> = {
  channelNonce: T;
  participants: Address[];
  multisigAddress: Address;
  appDefinition: Address;
  defaultTimeout: T;
};
export type AppIdentityBigNumber = AppIdentity<BigNumber>

// A structure representing the state of a CounterfactualApp instance from the POV of the blockchain
// NOTE: AppChallenge is the overall state of a channelized app instance,
// appStateHash is the hash of a state specific to the CounterfactualApp (e.g. chess position)
export type AppChallenge<T = string> = {
  appStateHash: HexString;
  versionNumber: T;
  finalizesAt: T;
  status: ChallengeStatus;
};
export type AppChallengeBigNumber = AppChallenge<BigNumber>

////////////////////////////////////////
// keep synced w contracts/adjudicator/libs/LibDispute.sol

// The status of a challenge in the ChallengeRegistry
export const enum ChallengeStatus {
  NO_CHALLENGE = 0,
  IN_DISPUTE = 1,
  IN_ONCHAIN_PROGRESSION = 2,
  EXPLICITLY_FINALIZED = 3,
  OUTCOME_SET = 4,
}

// Emitted by MixinProgressState.sol when an action is played on
// top of an onchain state so participants can derive new state
// in challenge
export type StateProgressedEvent = {
  identityHash: string;
  action: string; // encoded
  versionNumber: BigNumber;
  timeout: BigNumber;
  turnTaker: string; // eth addr
  signature: string; // of action taker
  emittedAt: BigNumber; // block number event was emitted at
}

// Emitted by the adjudicator contracts when fields in stored
// contract are changed by caller
export type ChallengeUpdatedEvent = {
  identityHash: string;
  status: ChallengeStatus;
  appStateHash: string; // latest app state
  versionNumber: BigNumber;
  finalizesAt: BigNumber;
  emittedAt: BigNumber; // block number event was emitted at
}

// events emitted by contracts
export const ContractEvents = enumify({
  StateProgressed: "StateProgressed",
  ChallengeUpdated: "ChallengeUpdated",
});
type ContractEvents = (typeof ContractEvents)[keyof typeof ContractEvents];
export type ContractEvent = keyof typeof ContractEvents;
