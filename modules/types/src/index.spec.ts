import { ethers } from "ethers";

import { convertFields } from "./index";

describe("convertFields", () => {
  const types = ["str", "bignumber"];
  const examples: any = {
    bignumber: ethers.utils.bigNumberify("69"),
    str: "69",
  };

  for (const fromType of types) {
    for (const toType of types) {
      test(`should convert ${fromType} -> ${toType}`, () => {
        const res = convertFields(fromType as any, toType as any, ["foo"], {
          foo: examples[fromType],
        });
        expect(res).toStrictEqual({
          foo: examples[toType],
        });
      });
    }
  }
});
