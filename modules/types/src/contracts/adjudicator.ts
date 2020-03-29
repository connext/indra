import { Address, HexString } from "../basic";
import { BigNumber } from "ethers/utils";

////////////////////////////////////////
// keep synced w contracts/adjudicator/libs/LibStateChannelApp.sol

// The status of a challenge in the ChallengeRegistry
export const enum ChallengeStatus {
  NO_CHALLENGE = 0,
  IN_DISPUTE = 1,
  IN_ONCHAIN_PROGRESSION = 2,
  EXPLICITLY_FINALIZED = 3,
}

// A minimal structure that uniquely identifies a single instance of an App
export type AppIdentity<T = string> = {
  channelNonce: T;
  participants: Address[];
  appDefinition: Address;
  defaultTimeout: T;
};
export type AppIdentityBigNumber = AppIdentity<BigNumber>

// A structure representing the state of a CounterfactualApp instance from the POV of the blockchain
// NOTE: AppChallenge is the overall state of a channelized app instance,
// appStateHash is the hash of a state specific to the CounterfactualApp (e.g. chess position)
export type AppChallenge<T = string> = {
  latestSubmitter: Address;
  appStateHash: HexString;
  versionNumber: T;
  finalizesAt: T;
  status: ChallengeStatus;
};
export type AppChallengeBigNumber = AppChallenge<BigNumber>