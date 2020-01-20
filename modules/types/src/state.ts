import { AppInstanceProposal, AppInstanceJson, SingleAssetTwoPartyIntermediaryAgreement } from "./cf";

export type StateChannelJSON = {
  readonly multisigAddress: string;
  readonly proxyFactoryAddress: string;
  readonly userNeuteredExtendedKeys: string[];
  readonly proposedAppInstances: [string, AppInstanceProposal][];
  readonly appInstances: [string, AppInstanceJson][];
  readonly singleAssetTwoPartyIntermediaryAgreements: [
    string,
    SingleAssetTwoPartyIntermediaryAgreement
  ][];
  readonly freeBalanceAppInstance: AppInstanceJson | undefined;
  readonly monotonicNumProposedApps: number;
};
