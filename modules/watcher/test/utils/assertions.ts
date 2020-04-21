import { waffleChai } from "@ethereum-waffle/chai";
import { use } from "chai";

/////////////////////////////
//// Assertions

use(require("chai-as-promised"));
use(require("chai-subset"));
use(waffleChai);

export { expect } from "chai";
