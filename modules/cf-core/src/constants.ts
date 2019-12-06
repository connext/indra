import { AddressZero } from "ethers/constants";

export { CF_PATH } from "@connext/types";

// Adds indentation, white space, and line break characters to the return-value
// JSON text to make it easier to read
export const JSON_STRINGIFY_SPACE = 2;

/**
 * We use 0x00...000 to represent an identifier for the ETH token
 * in places where values are indexed on token address. Of course,
 * in practice, there is no "token address" for ETH because it is a
 * native asset on the ethereum blockchain, but using this as an index
 * is convenient for storing this data in the same data structure that
 * also carries data about ERC20 tokens.
 */
export const CONVENTION_FOR_ETH_TOKEN_ADDRESS = AddressZero;

// 1 messaging timeout there, 1 messaging timeout back
// assume messaging timeout of 15s
export const IO_SEND_AND_WAIT_TIMEOUT = 90_000;
