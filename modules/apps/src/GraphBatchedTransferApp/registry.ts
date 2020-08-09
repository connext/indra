import {
  OutcomeType,
  GraphBatchedTransferAppName,
  GraphBatchedTransferAppStateEncoding,
  GraphBatchedTransferAppActionEncoding,
} from "@connext/types";

import { AppRegistryInfo } from "../shared";

export const GraphBatchSignedTransferAppRegistryInfo: AppRegistryInfo = {
  allowNodeInstall: true,
  name: GraphBatchedTransferAppName,
  outcomeType: OutcomeType.SINGLE_ASSET_TWO_PARTY_COIN_TRANSFER,
  stateEncoding: GraphBatchedTransferAppStateEncoding,
  actionEncoding: GraphBatchedTransferAppActionEncoding,
};
