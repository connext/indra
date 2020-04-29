import { BigNumber } from "ethers";

import { Address, HexString, Bytes32 } from "../basic";

////////////////////////////////////////
// keep synced w contracts/adjudicator/libs/LibStateChannelApp.sol

// A minimal structure that uniquely identifies a single instance of an App
export type AppIdentity = {
  channelNonce: BigNumber;
  participants: Address[];
  multisigAddress: Address;
  appDefinition: Address;
  defaultTimeout: BigNumber;
};

// A structure representing the state of a CounterfactualApp instance from the POV of the blockchain
// NOTE: AppChallenge is the overall state of a channelized app instance,
// appStateHash is the hash of a state specific to the CounterfactualApp (e.g. chess position)
export type AppChallenge = {
  appStateHash: HexString;
  versionNumber: BigNumber;
  finalizesAt: BigNumber;
  status: ChallengeStatus;
};

////////////////////////////////////////
// keep synced w contracts/adjudicator/libs/LibDispute.sol

// The status of a challenge in the ChallengeRegistry
export enum ChallengeStatus {
  NO_CHALLENGE = 0,
  IN_DISPUTE = 1,
  IN_ONCHAIN_PROGRESSION = 2,
  EXPLICITLY_FINALIZED = 3,
  OUTCOME_SET = 4,
}

export type SignedAppChallengeUpdate = {
  appStateHash: Bytes32;
  versionNumber: BigNumber;
  timeout: BigNumber;
  signatures: string[];
};

export type SignedCancelChallengeRequest = {
  versionNumber: BigNumber;
  signatures: string[];
};

// Emitted by MixinProgressState.sol when an action is played on
// top of an onchain state so participants can derive new state
// in challenge
const StateProgressedEventName = "StateProgressed";
export type StateProgressedEventPayload = {
  identityHash: string;
  action: string; // encoded
  versionNumber: BigNumber;
  timeout: BigNumber;
  turnTaker: Address; // eth addr
  signature: string; // of action taker
};

// Emitted by the adjudicator contracts when fields in stored
// contract are changed by caller
const ChallengeUpdatedEventName = "ChallengeUpdated";
export type ChallengeUpdatedEventPayload = {
  identityHash: Bytes32;
  status: ChallengeStatus;
  appStateHash: Bytes32; // latest app state
  versionNumber: BigNumber;
  finalizesAt: BigNumber;
};

// events emitted by contracts
export const ChallengeEvents = {
  [ChallengeUpdatedEventName]: ChallengeUpdatedEventName,
  [StateProgressedEventName]: StateProgressedEventName,
} as const;
export type ChallengeEvent = keyof typeof ChallengeEvents;

// event payloads
interface ChallengeEventsMap {
  [ChallengeUpdatedEventName]: ChallengeUpdatedEventPayload;
  [StateProgressedEventName]: StateProgressedEventPayload;
}
export type ChallengeEventData = {
  [P in keyof ChallengeEventsMap]: ChallengeEventsMap[P];
};

////////////////////////////////////////
// keep synced w contracts/adjudicator/mixins/MixinSetState.sol
export type MixinSetStateParams = {
  appIdentity: AppIdentity;
  req: SignedAppChallengeUpdate;
};

////////////////////////////////////////
// keep synced w contracts/adjudicator/mixins/MixinProgressState.sol
export type MixinProgressStateParams = MixinSetStateParams & {
  oldAppState: string; // encoded
  action: string; // encoded
};

////////////////////////////////////////
// keep synced w contracts/adjudicator/mixins/MixinCancelChallenge.sol
export type MixinCancelChallengeParams = {
  appIdentity: AppIdentity;
  req: SignedCancelChallengeRequest;
};

////////////////////////////////////////
// keep synced w contracts/adjudicator/mixins/MixinSetAndProgressState.sol
export type MixinSetAndProgressStateParams = {
  appIdentity: AppIdentity;
  // A signed app challenge update that contains the hash of the
  // latest state that has been signed by all parties
  // the timeout must be 0
  req1: SignedAppChallengeUpdate;
  // A signed app challenge update that contains the state that results
  // from applying the action to appState
  req2: SignedAppChallengeUpdate;
  appState: string; // encoded
  action: string; // encoded
};

////////////////////////////////////////
// keep synced w contracts/adjudicator/mixins/MixinSetOutcome.sol
export type MixinSetOutcomeParams = {
  appIdentity: AppIdentity;
  finalState: string; // final state of the challenge
};
