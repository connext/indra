import { Address, HexString } from "../basic";

////////////////////////////////////////
// keep synced w contracts/adjudicator/libs/LibStateChannelApp.sol

// The status of a challenge in the ChallengeRegistry
enum ChallengeStatus {
  NO_CHALLENGE = 0,
  FINALIZES_AFTER_DEADLINE = 1,
  EXPLICITLY_FINALIZED = 2,
}

// A minimal structure that uniquely identifies a single instance of an App
export type AppIdentity = {
  channelNonce: number;
  participants: Address[];
  appDefinition: Address;
  defaultTimeout: number;
};

// A structure representing the state of a CounterfactualApp instance from the POV of the blockchain
// NOTE: AppChallenge is the overall state of a channelized app instance,
// appStateHash is the hash of a state specific to the CounterfactualApp (e.g. chess position)
export type AppChallenge = {
  latestSubmitter: Address;
  appStateHash: HexString;
  challengeCounter: number;
  versionNumber: number;
  finalizesAt: number;
  status: ChallengeStatus;
};
