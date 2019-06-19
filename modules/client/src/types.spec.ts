import { insertDefault, objMapPromise, objMap } from "./lib/utils";
import { ethers } from "ethers";
import { convertFields } from "./types";

describe("insertDefault", () => {
  test("should work", () => {
    const tst = {
      testing: undefined,
      tokensToSell: "10",
    };
    const keys = ["testing", "all", "zeroes"];
    const ans = insertDefault("0", tst, keys);
    expect(ans).toStrictEqual({
      all: "0",
      testing: "0",
      tokensToSell: "10",
      zeroes: "0",
    });
  });
});

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

describe("objMap", () => {
  // should apply the same function to every value in the given
  // object
  test("should work with promises", async () => {
    const obj = {
      me: ethers.utils.bigNumberify(7),
      out: new Promise((resolve: any, rej: any): any => resolve("10")),
      test: "str",
    };

    const res = (await objMapPromise(
      obj,
      async (val: any, field: any): Promise<any> => field,
    )) as any;

    expect(res).toStrictEqual({
      me: ethers.utils.bigNumberify(7),
      out: "10",
      test: "str",
    });
  });

  test("should work with constant members", async () => {
    let args = {
      bignumber: ethers.utils.bigNumberify(8),
      num: 19,
      str: "This IS A CASIng TesT",
    };
    args = objMap(
      args,
      (k: any, v: any): any => (typeof v === "string" ? v.toLowerCase() : v),
    );
    expect(args).toStrictEqual({
      bignumber: ethers.utils.bigNumberify(8),
      num: 19,
      str: "this is a casing test",
    });
  });
});
