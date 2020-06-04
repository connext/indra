import {
  OutcomeType,
  HashLockTransferAppActionEncoding,
  HashLockTransferAppStateEncoding,
  HashLockTransferAppName,
} from "@connext/types";
import { constants } from "ethers";

import { AppRegistryInfo } from "../shared";

const { Zero } = constants;

export const HashLockTransferAppRegistryInfo: AppRegistryInfo = {
  name: HashLockTransferAppName,
  allowNodeInstall: true,
  actionEncoding: HashLockTransferAppActionEncoding,
  stateEncoding: HashLockTransferAppStateEncoding,
  outcomeType: OutcomeType.SINGLE_ASSET_TWO_PARTY_COIN_TRANSFER,
};

// timeout default values
export const HASHLOCK_TRANSFER_STATE_TIMEOUT = Zero;
