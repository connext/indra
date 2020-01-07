import { BigNumber, BigNumberish } from "ethers/utils";

expect.extend({
  toBeBigNumberEq(received: BigNumber, equalTo: BigNumberish): any {
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
  },
  toBeBigNumberGte(received: BigNumber, equalTo: BigNumberish): any {
    const pass = received.gte(equalTo);
    if (pass) {
      return {
        message: (): string =>
          `expected ${received.toString()} not to be greater than or equal to ${equalTo.toString()}`,
        pass: true,
      };
    }
    return {
      message: (): string =>
        `expected ${received.toString()} to be greater than or equal to ${equalTo.toString()}`,
      pass: false,
    };
  },
});

jest.setTimeout(90_000);
