import * as chai from "chai";
import * as chaiAsPromised from "chai-as-promised";
import { BigNumberish } from "ethers/utils";

chai.use(chaiAsPromised);

const { util, Assertion } = chai;

export const expect = chai.expect as any;

util.addMethod(Assertion.prototype, "bigNumberEq", function(expected: BigNumberish): void {
  // @ts-ignore
  const received = util.flag(this, "object");
  new Assertion(
    received.eq(expected),
    `expected ${JSON.stringify(received)} to equal ${expected.toString()}`,
  ).to.be.true;
});

util.addMethod(Assertion.prototype, "bigNumberGte", function(expected: BigNumberish): void {
  // @ts-ignore
  const received = util.flag(this, "object");
  new Assertion(
    received.gte(expected),
    `expected ${JSON.stringify(received)} to be greater than or equal to ${expected.toString()}`,
  ).to.be.true;
});