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

jest.setTimeout(90_000);
