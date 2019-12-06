import { bigNumberify } from "ethers/utils";
// Give abrv = true to abbreviate hex strings and xpubs to look like "xpub6FEC..kuQk"
export const stringify = (obj, abrv = false) =>
  JSON.stringify(
    obj,
    (key, value) =>
      value && value._hex
        ? bigNumberify(value).toString()
        : abrv && value && typeof value === "string" && value.startsWith("xpub")
        ? `${value.substring(0, 8)}..${value.substring(value.length - 4)}`
        : abrv && value && typeof value === "string" && value.startsWith("0x")
        ? `${value.substring(0, 6)}..${value.substring(value.length - 4)}`
        : value,
    2,
  );
