import { bigNumberify } from "ethers/utils";
import { calculateExchange } from "../../../test-runner/src/util";
import { One } from "ethers/constants";

describe("calculateExchange", () => {
  it("should work with small amounts", () => {
    const toExchange = One;
    const swapRate = "185.56";
    const ret = calculateExchange(toExchange, swapRate);
    const expected = bigNumberify(1 / 185.56);
    expect(ret.toString()).toBe(expected.toString());
  });
});
