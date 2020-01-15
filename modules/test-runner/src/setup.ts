import { Assertion, expect } from "chai";
import { BigNumber, BigNumberish } from "ethers/utils";

Assertion.addMethod("BigNumberEq", (received: BigNumber, equalTo: BigNumberish): {
  message: () => string;
  pass: boolean;
} => {
  const pass = received.eq(equalTo);
  if (pass) {
    return {
      message: (): string =>
        `expected ${received.toString()} not to be equal to ${equalTo.toString()}`,
      pass: true,
    };
  }
  return {
    message: (): string => `expected ${received.toString()} to be equal to ${equalTo.toString()}`,
    pass: false,
  };
});

Assertion.addMethod("BigNumberGte", (received: BigNumber, equalTo: BigNumberish): any => {
  const pass = received.gte(equalTo);
  if (pass) {
    return {
      message: (): string =>
        //  tslint:disable-next-line:max-line-length
        `expected ${received.toString()} not to be greater than or equal to ${equalTo.toString()}`,
      pass: true,
    };
  }
  return {
    message: (): string =>
      `expected ${received.toString()} to be greater than or equal to ${equalTo.toString()}`,
    pass: false,
  };
});

export { Assertion, expect };
