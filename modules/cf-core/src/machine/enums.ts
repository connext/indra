export { Commitment, Protocol } from "../types";

enum Opcode {
  /**
   * Requests a signature on the hash of previously generated EthereumCommitments.
   */
  OP_SIGN,

  /**
   * Middleware hook to send a ProtocolMessage to a peer.
   */
  IO_SEND,

  /**
   * Middleware hook to both send and wait for a response from a ProtocolMessage
   */
  IO_SEND_AND_WAIT,

  /**
   * Middleware hook to write the state channel to store. Used during the setup
   * protocol to persist the initial structure of the channel
   */
  PERSIST_STATE_CHANNEL,

  /**
   * Middleware hook to write the app instances to store.
   */
  PERSIST_APP_INSTANCE,

  /**
   * Middleware hook to write the free balance app to store.
   */
  PERSIST_FREE_BALANCE,

  /**
   * Called at the end of execution before the return value to store a
   * commitment
   */
  PERSIST_COMMITMENT,
}

export { Opcode };
