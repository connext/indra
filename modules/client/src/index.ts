import "core-js/stable";
import "regenerator-runtime/runtime";
import * as utils from "@connext/utils";
import { getUrlOptions, getDefaultOptions } from "./default";

import { connect } from "./connect";
import { ConnextClient } from "./connext";

export { ConnextClient, connect, utils, getUrlOptions, getDefaultOptions };
