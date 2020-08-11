import {
  OnlineLinkedTransferAppName,
  OutcomeType,
  SimpleLinkedTransferAppActionEncoding,
  SimpleLinkedTransferAppName,
  SimpleLinkedTransferAppStateEncoding,
} from "@connext/types";
import { constants } from "ethers";

import { AppRegistryInfo } from "../shared";

const { Zero } = constants;

export const SimpleLinkedTransferAppRegistryInfo: AppRegistryInfo = {
  actionEncoding: SimpleLinkedTransferAppActionEncoding,
  allowNodeInstall: true,
  name: SimpleLinkedTransferAppName,
  outcomeType: OutcomeType.SINGLE_ASSET_TWO_PARTY_COIN_TRANSFER,
  stateEncoding: SimpleLinkedTransferAppStateEncoding,
};

export const OnlineLinkedTransferAppRegistryInfo: AppRegistryInfo = {
  ...SimpleLinkedTransferAppRegistryInfo,
  name: OnlineLinkedTransferAppName,
};

// timeout default values
export const LINKED_TRANSFER_STATE_TIMEOUT = Zero;
