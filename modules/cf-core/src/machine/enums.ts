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
   * protocol to persist the initial structure/state of the channel
   */
  PERSIST_STATE_CHANNEL,

  /**
   * Middleware hook to write the app instances to store. Will also update
   * free balance app
   */
  PERSIST_APP_INSTANCE,

  /**
   * Called at the end of execution before the return value to store a
   * commitment
   */
  PERSIST_COMMITMENT,
}

export { Opcode };
