import { calculateExchange } from "../types";
import { One } from "ethers/constants";

describe("calculateExchange", () => {
  it("should work with small amounts", () => {
    const toExchange = One;
    const swapRate = "185.56";
    const ret = calculateExchange(toExchange, swapRate);
    const expected = "185";
    expect(ret.toString()).toBe(expected);
  });
});
