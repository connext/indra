
# Summary

## TL;DR I want to make things faster, what do we do?

 - Reduce variability: better visibility into node's lock service (eg if locks are blocking each other, let us know) is a good place to start investigating
 - Replace the `recoverAddress` call in `cf-core/src/protocol/utils/signature-validator.ts` w a crypto primitive that's not written in JS.

## re On-chain confirmation times

These benchmark numbers were recorded using ganache as the ethprovider set to auto-mine (aka zero-second block times). On-chain transactions generally take ~25 ms to be confirmed so their contribution to latency in these tests is negligible.

For example, breakdown of funding a client as part of test-runner's createClient() function:
 - Signed eth transfer tx in 137
 - Signed token transfer tx in 145
 - Eth + token transfer txs mined in 24

## Misc Observations

Some steps have very high variability. Steps that sometimes run in 50ms take 2000ms on subsequent runs w/out anything being different.

eg Acquiring a lock is generally a very fast operation, often the node responds in less than 5ms. This is one that sometimes takes > 1000ms though so there's something else going on that's blocking the node from responding as quickly as it could. Most likely, it's because another client has the lock and the node's response is blocked until that lock is released. But often lock responses take longest immediately after the node wakes up so this might be worth investigating more.

The wait between a sender initiating propose-protocol and waiting for the node to initiate install-protocol is another one that is sometimes 50ms and sometimes 2000

Requesting collateral stands out as a step that takes consistently > 1000ms.. Unexpected given that approximately none of the time is spent waiting for transactions to be resolved. BUT this action will always be paired w an on-chain transaction in real-life situations so it's not super high-priority to optimize the off-chain side of things.

Even if we get variability down to be consistently best case.. The best case still won't be able to transfer more than once per second. Eg install & uninstall protocols consistently take 200-300ms and most of that time is spent in a call to `ethers.utils.recoverAddress` (up to 100ms per address recovery), specifically in `cf-core/src/protocol/utils/signature-validator.ts` which, at it's core, is calling into the `elliptic` library, a pure-JS implementation of some EC crypto primitives.

## Closer look at transfers

A one-off install, transfer, uninstall flow involves protocols:

  50
 150 - sender propose
 250
 250 - sender install
 400
 100 - recipient propose
  25
 300 - recipient install
 150
 250 - recipient take action
  25
 250 - recipient uninstall
 500
 100 - sender take action
 650
 150 - sender uninstall

That's 1550ms spent in-protocol (including waiting for protocol messages) while the full flow usually takes a total of 3500-4500ms so we're spending less than half our time in protocol logic.

Almost a full second is spent between the sender finishing & the recipient starting & vice versa. Would it be worth it to try to speed this up?

# Example play-by-play metrics for full deposit, collateralize, transfer, withdraw flow.

## Setup

  300 - create ethprovider & get config
  100 - setup protocol
+ 200 - wait for channel to be available, setup subscriptions
 ------
  600 ms total for `client.connect()`

## Deposit

   50 - acquire lock
  150 - propose protocol initiation
  100 - clean up locks/subscriptions
  350 - install protocol initiation
  100 - sign/send/mine deposit tx
  250 - uninstall protocol initiation
+  50 - release locks, check free balance
 ------
 1050 ms total for `client.deposit()`

## Collateralize

  150 - setup locks, check free balance
  100 - propose protocol response
   75 - delay
  300 - install protocol response
   75 - delay
+ 150 - uninstall protocol response
 ------
  850 ms total for `client.requestCollateral()`

## Transfer (sender)

   50 - acquire lock
  200 - propose protocol initiation
 2000 - delay (highly variable, sometimes just 75ms)
  250 - install protocol response
+ 150 - listener cleanup?
 ------
 2650 ms total for `client.transfer()`

## Transfer (recipient)

    0 - delay between client.transfer() returning & recipient's subscription starting up
   15 - decrypt message (very fast crypto, great)
   85 - wait for event after sending resolve-linked message to node
  100 - propose protocol response
   15 - transition
  300 - install protocol initiation
   60 - transition
  200 - take action protocol initiation
   20 - transition
  250 - uninstall protocol initiation
+  20 - transition
 ------
 1100 ms total for client's linked transfer subscription callback

## Transfer (sender again)

   85 - delay between recipient finished & sender starting cleanup
  100 - take action protocol response
  250 - delay waiting for node
+ 150 - uninstall protocol response
 ------
 600 ms total for sender cleanup

That's about 4000ms for full transfer flow

## Withdraw (including state deposit holder deployment)

   20 - acquire lock & rescind deposit rights
  300 - deploy multisig
  100 - delay?
  800 - withdraw protocol initiation
  150 - wait for node response
 ------
 1450 ms total for withdraw

