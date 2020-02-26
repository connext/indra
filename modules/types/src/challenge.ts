import { Signature } from "ethers/utils";
import { AppIdentity } from "./app";

export type SetStateCommitmentJSON = {
  readonly appIdentity: AppIdentity;
  readonly appStateHash: string;
  readonly challengeRegistryAddress: string;
  readonly participantSignatures: Signature[];
  readonly timeout: number;
  readonly versionNumber: number;
};
