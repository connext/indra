import {
  OutcomeType,
  GraphSignedTransferAppName,
  GraphSignedTransferAppStateEncoding,
  GraphSignedTransferAppActionEncoding,
} from "@connext/types";
import { constants } from "ethers";

import { AppRegistryInfo } from "../shared";

const { Zero } = constants;

export const GraphSignedTransferAppRegistryInfo: AppRegistryInfo = {
  allowNodeInstall: true,
  name: GraphSignedTransferAppName,
  outcomeType: OutcomeType.SINGLE_ASSET_TWO_PARTY_COIN_TRANSFER,
  stateEncoding: GraphSignedTransferAppStateEncoding,
  actionEncoding: GraphSignedTransferAppActionEncoding,
};

// timeout default values
export const GRAPH_SIGNED_TRANSFER_STATE_TIMEOUT = Zero;
