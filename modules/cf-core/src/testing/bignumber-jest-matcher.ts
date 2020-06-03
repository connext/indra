import { utils } from "ethers";

declare global {
  namespace jest {
    interface Matchers<R, T> {
      toBeEq(expected: utils.BigNumberish): utils.BigNumber;
      toBeLt(expected: utils.BigNumberish): utils.BigNumber;
    }
  }
}

export function toBeEq(received: utils.BigNumber, argument: utils.BigNumberish) {
  const pass = received.eq(argument);
  return {
    pass,
    message: () => `expected ${received} to ${pass ? "not " : ""}be equal to ${argument}`,
  };
}

export function toBeLt(received: utils.BigNumber, argument: utils.BigNumberish) {
  const pass = received.lt(argument);
  return {
    pass,
    message: () => `expected ${received} to ${pass ? "not " : ""}be less than ${argument}`,
  };
}
