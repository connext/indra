import { use } from "chai";
import { BigNumber } from "ethers/utils";

use(require("chai-as-promised"));
use(require("chai-bn")(BigNumber));

export { expect } from "chai";
