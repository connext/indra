import { Event } from "ethers";
import { StateProgressedEvent, ChallengeUpdatedEvent } from "@connext/types";

// convert ethers emitted contract event to proper type
export const parseStateProgressedEvent = async (event: Event): Promise<StateProgressedEvent> => {
  throw new Error("Method not implemented");
};

// convert ethers emitted contract event to proper type
export const parseChallengeUpdatedEvent = async (event: Event): Promise<ChallengeUpdatedEvent> => {
  throw new Error("Method not implemented");
};
