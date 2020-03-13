import { Address, DecString, HexString } from "../basic";

////////////////////////////////////////
// keep synced w contracts/adjudicator/libs/LibStateChannelApp.sol

// The status of a challenge in the ChallengeRegistry
enum ChallengeStatus {
  NO_CHALLENGE = 0,
  FINALIZES_AFTER_DEADLINE = 1,
  EXPLICITLY_FINALIZED = 2,
}

// A minimal structure that uniquely identifies a single instance of an App
type AppIdentity = {
  channelNonce: DecString;
  participants: Address[];
  appDefinition: Address[];
  defaultTimeout: DecString;
};

// A structure representing the state of a CounterfactualApp instance from the POV of the blockchain
// NOTE: AppChallenge is the overall state of a channelized app instance,
// appStateHash is the hash of a state specific to the CounterfactualApp (e.g. chess position)
type AppChallenge = {
  latestSubmitter: Address;
  appStateHash: HexString;
  challengeCounter: DecString;
  versionNumber: DecString;
  finalizesAt: DecString;
  status: ChallengeStatus;
};
