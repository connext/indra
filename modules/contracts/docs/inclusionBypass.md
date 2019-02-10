*tl;dr:* Allowing `startExitThreadWithUpdate` and `challengeThread` to bypass the inclusion check for updated states simply by passing in `bytes32(0x0)` for the thread root opens up a vulnerability.

We fix this vuln by strengthening the conditions for bypassing the check in `_verifyThread` from

```
if(threadRoot != bytes32(0x0)) {
    ...
}
```

to

```
if(threadRoot != bytes32(0x0) || (threadRoot == bytes32(0x0) && txCount == 0)) {
    ...
} 
```

# Inclusion Proof Bypass

### Background

Recall that, in order to dispute a thread, we first prove that it exists by doing a merkle inclusion proof of the initial (`txCount == 0`) state of the thread when calling either `startExitThread` or `startExitThreadWithUpdate`.

This only happens for the initial state of the thread because it is possible that not all parties (specifically, the hub) are aware of changes to state. Since the hub's bond "nets" to 0 across both channels that the thread is constructed over, the hub only needs to prove that the thread _exists_ in order to retrieve their bonded funds.

Previously, we skipped the merkle inclusion check in `_verifyThread` by enclosing it in,
```
if(threadRoot != bytes32(0x0)) {
    ...
}
```
...and then passing in `bytes32(0x0)` for the threadRoot in `challengeThread` and in the update portion of `startExitThreadWithUpdate`.

### Vulnerability

The above pattern introduces a vulnerability where it is possible for the sender and hub to collaborate in order to doublespend funds within the thread.

Suppose that the sender and receiver wish to open a thread with each other where the sender deposits 10 WEI:

Following the protocol, a malicious hub would prepare two channel updates and an initial thread state for opening the thread. First, the hub would create a (normal) update for the receiver's channel with
```
{
    ...channel.state
    weiBalanceHub = weiBalanceHub - 10 WEI
    threadRoot = hash(threadInitialState)
    threadCount = threadCount + 1
}
``` 
Then, the hub would create a (malicious) update in the sender's channel with
```
{
    ...channel.state
    weiBalanceUser = weiBalanceUser - 10 WEI
    threadRoot = bytes32(0x0)
    threadCount = threadCount + 1
}
``` 

A malicious sender would countersign this - technically incorrect - update and then would go about paying WEI in the thread as per normal. Then, after paying their balance, the sender would initiate a dispute with the hub.

The `emptyChannel` function would notice that `threadCount > 0` and put the channel into the `ThreadDispute` status. However, the *root hash would remain 0x0 onchain*.

Since a 0x0 root hash would bypass the inclusion check, this would mean that the malicious sender could now propose _any_ initial thread state when calling `startExitThread`. To doublespend, the sender could then create an initial thread state for 9 WEI instead of 10 and sign it (recall that only the sender needs to sign since threads are unidirectional). Since all higher `txCount` states would need to conserve the same total WEI in the thread, starting exit with the 9 WEI thread state would invalidate _all_ thread updates (pending payments) held by the receiver.

While invalidating thread updates isn't directly allowing the hub/sender to _steal_ funds, it does violate the principle that actions within payment channels should have finality (that is to say, they cannot be reversed). Invalidating the set of original thread updates here means that the sender/hub are able to get 10 WEI of the receiver's services at the cost of only 1 WEI.

The sender and hub can then exit the thread using the initial state and make back 9 WEI from the 10 WEI that they spent.

### Remediation

Note that we allow the inclusion check bypass because we want to skip the check in the cases where the initial state of the thread _has already been verified_.

In other words, we want to skip the check _only_ in the case where `threadRoot == bytes32(0x0) && txCount > 0 `. (We don't check against threadCount because threadCount must necessarily be greater than zero in order to call this code path).

There are 3 other possible cases (all of which should be checked):

1. `threadRoot != bytes32(0x0) && txCount == 0` - the "normal" case where we are putting initial state on chain
2. `threadRoot != bytes32(0x0) && txCount > 0` - technically never happens because we hardcode 0x0 for updates
3. `threadRoot == bytes32(0x0) && txCount == 0` - the malicious case explained above

Therefore, to fix the vulnerability, we need to update the conditions under which the inclusion check is skipped to:

```
if(threadRoot != bytes32(0x0) || (threadRoot == bytes32(0x0) && txCount == 0)) {
    // Do inclusion check
}
```
