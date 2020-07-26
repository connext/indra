import { CF_METHOD_TIMEOUT } from "@connext/types";

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
  freeBalanceDefaultTimeout: 8640, // 24h
  freeBalanceInitialStateTimeout: 8640,
  // We assume the Free Balance is the first app ever installed
  appSequenceNumberForFreeBalance: 1,
};

// 1 messaging timeout there, 1 messaging timeout back
// assume messaging timeout of 10s
export const IO_SEND_AND_WAIT_TIMEOUT = CF_METHOD_TIMEOUT / 2;

export const MAX_CHANNEL_APPS = parseInt(process.env.EXPERIMENTAL_MAX_CHANNEL_APPS || "0") || 25;
