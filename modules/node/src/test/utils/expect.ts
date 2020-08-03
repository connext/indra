import { expect, use } from "chai";
import { waffleChai } from "@ethereum-waffle/chai";

use(waffleChai);
use(require("chai-as-promised"));
use(require("chai-subset"));

export { expect };
