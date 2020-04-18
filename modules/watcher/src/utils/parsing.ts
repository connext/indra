import { Event } from "ethers";
import { StateProgressedContractEvent, ChallengeUpdatedContractEvent } from "@connext/types";

// convert ethers emitted contract event to proper type
export const parseStateProgressedEvent = async (
  event: Event,
): Promise<StateProgressedContractEvent> => {
  throw new Error("Method not implemented");
};

// convert ethers emitted contract event to proper type
export const parseChallengeUpdatedEvent = async (
  event: Event,
): Promise<ChallengeUpdatedContractEvent> => {
  console.log(`**** parsing event`, event);
  return event as any;
};
