import { expect, use } from "chai";
import chaiAsPromised from "chai-as-promised";
import { waffleChai } from "@ethereum-waffle/chai";

use(chaiAsPromised);
use(waffleChai);

export { expect };
