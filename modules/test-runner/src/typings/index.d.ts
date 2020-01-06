export {};

declare global {
  namespace jest {
    interface Matchers<R, T> {
      toBeBigNumberEq(equalTo: BigNumberish): R;
    }
  }
}