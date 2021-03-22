import "core-js/stable";
import "regenerator-runtime/runtime";
import * as utils from "@connext/utils";

import { connect } from "./connect";
import { ConnextClient } from "./connext";
import { getUrlOptions, getDefaultOptions } from "./default";

export { ConnextClient, connect, utils, getUrlOptions, getDefaultOptions };
