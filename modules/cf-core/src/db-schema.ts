/**
 * Namespace under which the channels are stored.
 */
export const DB_NAMESPACE_CHANNEL = "channel";

/**
 * appIdentityHash explanation:
 *
 * When a Node client initiates an `AppInstance` installation proposal, a UUID is
 * generated in the Node to identify this proposed `AppInstance`. To the Node
 * clients, this UUID becomes the ID of the `AppInstance` they proposed to install,
 * hence appIdentityHash.
 * This enables the client to immediately get a response from the Node with
 * an ID to use as a handle for the proposed `AppInstance`.
 *
 * When a peer Node receiving this proposal accepts it and installs it, this
 * installation generates the appIdentityHash for the app instance as the
 * act of installation updates the state of the channel. The two IDs,
 * appIdentityHash and appIdentityHash are then globally mapped
 * (i.e. by all participating Nodes) to each other. Any time any clients use the
 * appIdentityHash to refer to the `AppInstance`, the Node does a look up
 * for the appIdentityHash to get/set any state for that `AppInstance` inside
 * the relevant channel.
 */

export const DB_NAMESPACE_ALL_COMMITMENTS = "allCommitments";

/**
 * Namespace for storing withdrawals
 */
export const DB_NAMESPACE_WITHDRAWALS = "multisigAddressToWithdrawalCommitment";
