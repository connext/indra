import { AppInstanceProposal, AppInstanceJson } from "./app";
import { SingleAssetTwoPartyIntermediaryAgreement } from "./contracts";

// Increment this every time StateChannelJSON is modified
// This is used to signal to clients that they need to delete/restore their state
export const StateSchemaVersion = 1;

// Contract addresses that must be provided to withdraw funds from a channel
// Losing track of a critical address means losing access to the funds in that channel
// Each channel must track it's own critical addresses because there's no
//   guarantee that these addresses will be the same across different channels
export type CriticalStateChannelAddresses = {
  proxyFactory: string;
  multisigMastercopy: string;
};

export type StateChannelJSON = {
  readonly schemaVersion: number;
  readonly multisigAddress: string; // TODO: remove & replace w getter fn?
  readonly addresses: CriticalStateChannelAddresses;
  readonly userNeuteredExtendedKeys: string[];
  readonly proposedAppInstances: [string, AppInstanceProposal][];
  readonly appInstances: [string, AppInstanceJson][];
  readonly singleAssetTwoPartyIntermediaryAgreements: [string, SingleAssetTwoPartyIntermediaryAgreement][];
  readonly freeBalanceAppInstance: AppInstanceJson | undefined;
  readonly monotonicNumProposedApps: number;
};
