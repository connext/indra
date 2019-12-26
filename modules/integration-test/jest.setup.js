expect.extend({
  toBeBigNumberEq(
    received,
    equalTo,
  ) {
    const pass = received.eq(equalTo);
    if (pass) {
      return {
        message: () =>
          `expected ${received.toString()} not to be equal to ${equalTo.toString()}`,
        pass: true,
      };
    }
    return {
      message: () => `expected ${received.toString()} to be equal to ${equalTo.toString()}`,
      pass: false,
    };
  },
});

jest.setTimeout(30_000);
