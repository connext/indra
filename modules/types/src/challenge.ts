import { Signature } from "ethers/utils";
import { AppIdentity } from "./app";
import { NetworkContext } from "./contracts";

export type SetStateCommitmentJSON = {
  readonly appIdentity: AppIdentity;
  readonly appIdentityHash: string;
  readonly appStateHash: string;
  readonly challengeRegistryAddress: string;
  readonly signatures: Signature[];
  readonly timeout: number;
  readonly versionNumber: number;
};

export type ConditionalTransactionCommitmentJSON = {
  readonly appIdentityHash: string;
  readonly freeBalanceAppIdentityHash: string;
  readonly interpreterAddr: string;
  readonly interpreterParams: string;
  readonly multisigAddress: string;
  readonly multisigOwners: string[];
  readonly networkContext: NetworkContext;
  readonly signatures: Signature[];
};
