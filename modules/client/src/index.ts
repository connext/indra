import "core-js/stable";
import "regenerator-runtime/runtime";
import { xkeyKthAddress as addressToAddress } from "@connext/cf-core";

import { connect } from "./connect";
import { ConnextClient } from "./connext";
import { CF_METHOD_TIMEOUT, Currency } from "./lib";

export const utils = {
  Currency,
  addressToAddress,
  CF_METHOD_TIMEOUT,
};
export { ConnextClient, connect };
