import { AddressZero } from "ethers/constants";

/**
 * @summary This is a `seq` value that messages can take on which
 * _should not_ be submitted into the protocol execution. A message
 * with seq === -1 should be considered a response to another message
 * and this should continue after an IO_SEND_AND_WAIT opcode.
 */
export const UNASSIGNED_SEQ_NO = -1;

// Adds indentation, white space, and line break characters to the return-value
// JSON text to make it easier to read
export const JSON_STRINGIFY_SPACE = 2;

export const HARD_CODED_ASSUMPTIONS = {
  freeBalanceDefaultTimeout: 172800,
  freeBalanceInitialStateTimeout: 172800,
  // We assume the Free Balance is the first app ever installed
  appSequenceNumberForFreeBalance: 0,
};

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
