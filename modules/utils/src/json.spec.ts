import {BigNumber} from 'ethers/utils';

import {bigNumberifyJson, deBigNumberifyJson, safeJsonParse, safeJsonStringify} from './json';

const TEST_JSON = { test: "something", nullfied: undefined };
const TEST_JSON_WITH_NULL = { test: "something", nullfied: null };
const VALID_JSON_STRING = `{"test":"something","nullfied":null}`;
const INVALID_JSON_STRING = VALID_JSON_STRING.replace("{", "");

const TEST_JSON_WITH_BN_OBJ = { amount: new BigNumber(1) };
const TEST_JSON_WITH_BN_JSON = { amount: { _hex: "0x01" } };
// const TEST_JSON_WITH_BN_JSON = { amount: { _hex: "0x01", _isBigNumber: true } };

const TEST_JSON_WITH_BN_OBJECT_DEPTH = {
  amount: new BigNumber(1),
  otherStuff: {
    amount: new BigNumber(1),
    deeper: {
      amount: new BigNumber(1),
      deepProp: 'hello',
      evenDeeper: {
        value: new BigNumber(2),
      },
    }
  },
  arrayStuff: [
    new BigNumber(1),
    'not bignum',
    {
      deepBignum: new BigNumber(1),
      superDeepBignum: {
        soDeep: new BigNumber(1)
      },
    }
  ],
  nullProp: null,
  undefProp: undefined,
  someOtherProp: 1,
};

const TEST_JSON_WITH_BN_JSON_DEPTH = {
  amount: {
    _hex: '0x01',
  },
  otherStuff: {
    amount: {
      _hex: '0x01',
    },
    deeper: {
      amount: {
        _hex: '0x01'
      },
      deepProp: 'hello',
      evenDeeper: {
        value: new BigNumber(2),
      }
    }
  },
  arrayStuff: [
    {
      _hex: '0x01',
    },
    'not bignum',
    {
      deepBignum: {
        _hex: '0x01',
      },
      superDeepBignum: {
        soDeep: new BigNumber(1),
      }
    }
  ],
  nullProp: null,
  undefProp: undefined,
  someOtherProp: 1,
};

describe("JSON", () => {
  describe("bigNumberifyJson", () => {
    it("return json with BigNumber values", () => {
      const input = TEST_JSON_WITH_BN_JSON;
      const expected = TEST_JSON_WITH_BN_OBJ;
      const result = bigNumberifyJson(input);
      expect(result).toEqual(expected);
    });
    it("handles depths", () => {
      const input = TEST_JSON_WITH_BN_JSON_DEPTH;
      const expected = TEST_JSON_WITH_BN_OBJECT_DEPTH;
      const result = bigNumberifyJson(input);
      expect(result).toEqual(expected);
    })
  });
  describe("deBigNumberifyJson", () => {
    it("return json with BigNumberJson values", () => {
      const input = TEST_JSON_WITH_BN_OBJ;
      const expected = TEST_JSON_WITH_BN_JSON;
      const result = deBigNumberifyJson(input);
      expect(result).toEqual(expected);
    });
    it("handles depths", () => {
      const input = TEST_JSON_WITH_BN_OBJECT_DEPTH;
      const expected = TEST_JSON_WITH_BN_JSON_DEPTH;
      const result = deBigNumberifyJson(input);
      expect(result).toEqual(expected);
    });
  });
  describe("safeJsonStringify", () => {
    it("return stringified json if provided valid json", () => {
      const input = TEST_JSON;
      const expected = VALID_JSON_STRING;
      const result = safeJsonStringify(input);
      expect(result).toEqual(expected);
    });
  });
  describe("safeJsonParse", () => {
    it("return valid json if provided valid stringified json", () => {
      const input = VALID_JSON_STRING;
      const expected = TEST_JSON_WITH_NULL;
      const result = safeJsonParse(input);
      expect(result).toEqual(expected);
    });
    it("return same input if provided invalid stringified json", () => {
      const input = INVALID_JSON_STRING;
      const expected = INVALID_JSON_STRING;
      const result = safeJsonParse(input);
      expect(result).toEqual(expected);
    });
    it("return same input if not provided a string", () => {
      const input = TEST_JSON;
      const expected = TEST_JSON;
      const result = safeJsonParse(input);
      expect(result).toEqual(expected);
    });
  });
});
