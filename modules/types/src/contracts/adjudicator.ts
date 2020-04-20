import { Address, HexString, Bytes32 } from "../basic";
import { BigNumber } from "ethers/utils";

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
export type AppIdentityBigNumber = AppIdentity<BigNumber>;

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
export const enum ChallengeStatus {
  NO_CHALLENGE = 0,
  IN_DISPUTE = 1,
  IN_ONCHAIN_PROGRESSION = 2,
  EXPLICITLY_FINALIZED = 3,
  OUTCOME_SET = 4,
}

export type SignedAppChallengeUpdate<T = string> = {
  appStateHash: Bytes32;
  versionNumber: number | T; // number for backwards compatability, TODO: remove
  timeout: number | T; // number for backwards compatability, TODO: remove
  signatures: string[];
};
export type SignedAppChallengeUpdateBigNumber = SignedAppChallengeUpdate<BigNumber>;

export type SignedCancelChallengeRequest<T = string> = {
  versionNumber: T;
  signatures: string[];
};
export type SignedCancelChallengeRequestBigNumber = SignedCancelChallengeRequest<BigNumber>;

// Emitted by MixinProgressState.sol when an action is played on
// top of an onchain state so participants can derive new state
// in challenge
export const StateProgressed = "StateProgressed";
export type StateProgressedContractEvent = {
  identityHash: string;
  action: string; // encoded
  versionNumber: BigNumber;
  timeout: BigNumber;
  turnTaker: Address; // eth addr
  signature: string; // of action taker
};

// Emitted by the adjudicator contracts when fields in stored
// contract are changed by caller
export const ChallengeUpdated = "ChallengeUpdated";
export type ChallengeUpdatedContractEvent = {
  identityHash: Bytes32;
  status: ChallengeStatus;
  appStateHash: Bytes32; // latest app state
  versionNumber: BigNumber;
  finalizesAt: BigNumber;
};

// events emitted by contracts
export const ChallengeEvents = {
  [ChallengeUpdated]: ChallengeUpdated,
  [StateProgressed]: StateProgressed,
} as const;
export type ChallengeEvent = keyof typeof ChallengeEvents;
// event payloads
interface ChallengeEventsMap {
  [ChallengeUpdated]: ChallengeUpdatedContractEvent;
  [StateProgressed]: StateProgressedContractEvent;
}
export type ChallengeEventData = {
  [P in keyof ChallengeEventsMap]: ChallengeEventsMap[P];
};

////////////////////////////////////////
// keep synced w contracts/adjudicator/mixins/MixinSetState.sol
export type MixinSetStateParams = {
  appIdentity: AppIdentityBigNumber;
  req: SignedAppChallengeUpdateBigNumber;
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
  appIdentity: AppIdentityBigNumber;
  req: SignedCancelChallengeRequestBigNumber;
};

////////////////////////////////////////
// keep synced w contracts/adjudicator/mixins/MixinSetAndProgressState.sol
export type MixinSetAndProgressStateParams = {
  appIdentity: AppIdentityBigNumber;
  // A signed app challenge update that contains the hash of the
  // latest state that has been signed by all parties
  // the timeout must be 0
  req1: SignedAppChallengeUpdateBigNumber;
  // A signed app challenge update that contains the state that results
  // from applying the action to appState
  req2: SignedAppChallengeUpdateBigNumber;
  appState: string; // encoded
  action: string; // encoded
};

////////////////////////////////////////
// keep synced w contracts/adjudicator/mixins/MixinSetOutcome.sol
export type MixinSetOutcomeParams = {
  appIdentity: AppIdentityBigNumber;
  finalState: string; // final state of the challenge
};
