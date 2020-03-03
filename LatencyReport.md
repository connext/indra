
Note: these benchmark numbers were recorded using ganache as the ethprovider set to auto-mine (aka zero-second block times). On-chain transactions generally take ~25 ms to be confirmed so their contribution to latency in these tests is negligible.

For example, breakdown of funding a client as part of test-runner's createClient() function:
 - Signed eth transfer tx in 137
 - Signed token transfer tx in 145
 - Eth + token transfer txs mined in 24

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

