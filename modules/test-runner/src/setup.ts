import { Assertion, expect, util } from "chai";
import { BigNumberish } from "ethers/utils";

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

// Assertion.addMethod("bigNumberEq", (received: BigNumber, equalTo: BigNumberish): {
//   message: () => string;
//   pass: boolean;
// } => {
//   const pass = received.eq(equalTo);
//   if (pass) {
//     return {
//       message: (): string =>
//         `expected ${received.toString()} not to be equal to ${equalTo.toString()}`,
//       pass: true,
//     };
//   }
//   return {
//     message: (): string => `expected ${received.toString()} to be equal to ${equalTo.toString()}`,
//     pass: false,
//   };
// });

// Assertion.addMethod("BigNumberGte", (received: BigNumber, equalTo: BigNumberish): any => {
//   const pass = received.gte(equalTo);
//   if (pass) {
//     return {
//       message: (): string =>
//         //  tslint:disable-next-line:max-line-length
//         `expected ${received.toString()} not to be greater than or equal to ${equalTo.toString()}`,
//       pass: true,
//     };
//   }
//   return {
//     message: (): string =>
//       `expected ${received.toString()} to be greater than or equal to ${equalTo.toString()}`,
//     pass: false,
//   };
// });

export { Assertion, expect };
