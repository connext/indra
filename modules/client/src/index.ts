import "core-js/stable";
import "regenerator-runtime/runtime";
import {
  getPublicKeyFromPublicIdentifier,
  getPublicIdentifierFromPublicKey,
  getSignerAddressFromPublicIdentifier,
} from "@connext/crypto";

import { connect } from "./connect";
import { ConnextClient } from "./connext";
import { CF_METHOD_TIMEOUT, Currency } from "./lib";

export const utils = {
  CF_METHOD_TIMEOUT,
  Currency,
  getPublicIdentifierFromPublicKey,
  getPublicKeyFromPublicIdentifier,
  getSignerAddressFromPublicIdentifier,
};
export { ConnextClient, connect };
