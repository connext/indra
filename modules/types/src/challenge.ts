import { BigNumber } from "ethers/utils";
import { AppInstanceJson } from "./app";

////////////////////////////////////////
/// Types for challenges (aka disputes)
////////////////////////////////////////

export const NO_CHALLENGE = "NO_CHALLENGE";
export const FINALIZES_AFTER_DEADLINE = "FINALIZES_AFTER_DEADLINE";
export const EXPLICITLY_FINALIZED = "EXPLICITLY_FINALIZED";
export const OUTCOME_SET = "OUTCOME_SET";

export const ChallengeStatuses = {
  [NO_CHALLENGE]: NO_CHALLENGE,
  [FINALIZES_AFTER_DEADLINE]: FINALIZES_AFTER_DEADLINE,
  [EXPLICITLY_FINALIZED]: EXPLICITLY_FINALIZED,
  [OUTCOME_SET]: OUTCOME_SET,
};
export type ChallengeStatus = keyof typeof ChallengeStatuses;

export type AppChallenge<T = string> = {
  status: ChallengeStatus;
  latestSubmitter: string;
  appStateHash: string;
  challengeCounter: T;
  versionNumber: T;
  finalizesAt: T;
};
export type AppChallengeBigNumber = AppChallenge<BigNumber>;

export type ChallengeJson = {
  app: AppInstanceJson;
  count: BigNumber;
  finalizesAt: BigNumber;
  latestSubmitter: string;
  status: ChallengeStatus;
};
