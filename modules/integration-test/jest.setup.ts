import { BigNumber, BigNumberish } from "ethers/utils";

expect.extend({
  toBeBigNumberEq(
    received: BigNumber,
    equalTo: BigNumberish,
  ): { message: () => string; pass: boolean } {
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
});

declare global {
  namespace jest {
    interface Matchers<R, T> {
      toBeBigNumberEq(equalTo: BigNumberish): R;
    }
  }
}

jest.setTimeout(30_000);
