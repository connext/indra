import {
  OutcomeType,
  GraphSignedTransferAppName,
  GraphSignedTransferAppStateEncoding,
  GraphSignedTransferAppActionEncoding,
} from "@connext/types";
import { constants } from "ethers";

import { AppRegistryInfo } from "../shared";

const { Zero } = constants;

// timeout default values
export const GRAPH_SIGNED_TRANSFER_STATE_TIMEOUT = Zero;

export const GraphSignedTransferAppRegistryInfo: AppRegistryInfo = {
  allowNodeInstall: true,
  name: GraphSignedTransferAppName,
  outcomeType: OutcomeType.SINGLE_ASSET_TWO_PARTY_COIN_TRANSFER,
  stateEncoding: GraphSignedTransferAppStateEncoding,
  actionEncoding: GraphSignedTransferAppActionEncoding,
  stateTimeout: GRAPH_SIGNED_TRANSFER_STATE_TIMEOUT
};

