import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import chaiSubset from "chai-subset";
import { waffleChai } from "@ethereum-waffle/chai";

chai.use(waffleChai);
chai.use(chaiAsPromised);
chai.use(chaiSubset);

export const expect = chai.expect;
