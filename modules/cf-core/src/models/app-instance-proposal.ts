import {
  AppABIEncodings,
  OutcomeType,
  SolidityValueType
} from "@connext/cf-types";

export interface AppInstanceProposal {
  identityHash: string;
  appDefinition: string;
  abiEncodings: AppABIEncodings;
  initiatorDeposit: string;
  initiatorDepositTokenAddress: string;
  responderDeposit: string;
  responderDepositTokenAddress: string;
  timeout: string;
  initialState: SolidityValueType;
  appSeqNo: number;
  proposedByIdentifier: string;
  proposedToIdentifier: string;
  intermediaryIdentifier?: string;
  outcomeType: OutcomeType;
}
