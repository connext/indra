import {
  OutcomeType,
  GraphMultiTransferAppName,
  GraphMultiTransferAppStateEncoding,
  GraphMultiTransferAppActionEncoding,
} from "@connext/types";
import { constants } from "ethers";

import { AppRegistryInfo, DEFAULT_APP_TIMEOUT } from "../shared";

const { Zero } = constants;

// timeout default values
export const GRAPH_MULTI_TRANSFER_STATE_TIMEOUT = DEFAULT_APP_TIMEOUT;

export const GraphMultiTransferAppRegistryInfo: AppRegistryInfo = {
  allowNodeInstall: true,
  name: GraphMultiTransferAppName,
  outcomeType: OutcomeType.SINGLE_ASSET_TWO_PARTY_COIN_TRANSFER,
  stateEncoding: GraphMultiTransferAppStateEncoding,
  actionEncoding: GraphMultiTransferAppActionEncoding,
  stateTimeout: GRAPH_MULTI_TRANSFER_STATE_TIMEOUT,
};
