import { AppInstanceProposal, AppInstanceJson } from "./app";
import { Address, Bytes32, PublicIdentifier } from "./basic";
import { CriticalStateChannelAddresses } from "./contracts";
import { SetStateCommitmentJSON } from "./commitments";

// Increment this every time StateChannelJSON is modified
// This is used to signal to clients that they need to delete/restore their state
export const StateSchemaVersion = 2;

export type StateChannelJSON = {
  readonly schemaVersion: number;
  readonly multisigAddress: Address; // TODO: rm & calculate from critical addresses on rehydrate?
  readonly addresses: CriticalStateChannelAddresses;
  readonly userIdentifiers: PublicIdentifier[];
  readonly proposedAppInstances: [Bytes32, AppInstanceProposal][];
  readonly appInstances: [Bytes32, AppInstanceJson][];
  readonly freeBalanceAppInstance: AppInstanceJson | undefined;
  readonly monotonicNumProposedApps: number;
};

export type FullChannelJSON = StateChannelJSON & {
  freeBalanceSetStateCommitment: SetStateCommitmentJSON
}
