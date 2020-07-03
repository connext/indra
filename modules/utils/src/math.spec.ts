import { expect } from "chai";

import { toWad, fromWad, inverse, sanitizeDecimals, calculateExchange } from "./math";

describe("Math", () => {
  it("toWad", () => {
    expect(toWad("1").toString()).to.be.equal("1000000000000000000");
  });
  it("fromWad", () => {
    expect(fromWad("1000000000000000000")).to.be.equal("1.0");
  });
  it("inverse", () => {
    expect(inverse("100")).to.be.equal("0.01");
  });
  it("sanitizeDecimals", () => {
    expect(sanitizeDecimals("100.2901385789273895723895782234234234234234234234233")).to.be.equal(
      "100.290138578927389572",
    );
  });
  it("calculateExchange", () => {
    expect(calculateExchange("0.1", "100")).to.be.equal("10");
  });
});
