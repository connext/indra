# Disputing a Transaction

_When Alice and Bob \(or Alice and the Hub\) disagree, all parties involved can use the blockchain to dispute the transaction. While a Hub operator may want you to go through their support system to dispute \(they likely have a vested interest in ensuring a good outcome for you\), any party always has the option of disputing a transaction using the blockchain. This is important in case the Hub is \(i\) unresponsive or \(ii\) trying to cheat._

_Here, we outline the process for disputing a transaction using functions in the client package._ 

**\*\*\*VERY Important note\*\*\*:** Automated disputes have not been implemented in the Hub in v1.0. If a user disputes a transaction, the Hub operator will have to manually counter. This is possible, but a real PITA which is why we reccomend not putting your Hub on mainnet yet. Autodisputing will be added on the next update.

## Closing Threads 

When Alice and Bob are finished transacting in their thread, we can close it using [`closeThread()`](../client-docs-2.0.md#closethread). When `closeThread()` is called, there are two possible scenarios: \(i\) the hub agrees with the balance that Alice has submitted and countersigns the submitted update or \(ii\) the hub disagrees and does not countersign the update. 

**How to handle disputes:**

If Alice and the hub disagree on final thread balances, the hub will not countersign the update that Alice submits using `closeThread()` and will instead return error code `651`. 

To resolve the error, we will need to initiate a dispute resolution process. First, we call `initThreadStateContractHandler()` to put the initial state on the blockchain. Essentially, this tells the blockchain that the two parties agreed to enter into their channel with a given set of funds, under a set of dispute conditions. 

```javascript
//Put initial thread state on-chain
await client.initThreadStateContractHandler({
        channelId: channelForAlice, // caller channel
        aliceToBobThread,//Thread Id
        nonce: 0,
        Alice, //Thread sender
        Bob, // Thread recipient
        balanceA: Web3.utils.toBN(aliceToBobThread.balanceA), // initial balance
        balanceB: Web3.utils.toBN(aliceToBobThread.balanceB), // initial balance; should always be 0
        sigAlice: aliceToBobThread.sigAlice, //signature provided when starting channel
        sender: Alice // optional, for testing
      })
```

Once that transaction is confirmed on-chain \(which may take a few minutes\), we identify the most recent double-signed thread update \(the update with the highest "nonce"\) using `getLatestThreadStateUpdate()` and submit it to the blockchain using `settleThreadContractHandler()`.

```javascript
//Settle thread using latest nonce
let threadN = await client.getLatestThreadStateUpdate(aliceToBobThread)
const response = await client.settleThreadContractHandler({
  channelId: channelForAlice,
  aliceToBobThread,
  nonce: threadN.nonce,
  Alice,
  Bob, 
  balanceA: Web3.utils.toBN(aliceToBobThread.balanceA),
  balanceB: Web3.utils.toBN(aliceToBobThread.balanceB),
  sigAlice: vcN.sigAlice, //signature on latest nonce-dd transaction
  sender: Alice 
})
```

Calling this function will initiate a challenge period, during which Alice will have the opportunity to submit a more recent, double-signed state update using the same method. For her, this complexity is easily abstracted away through UX.

Once the challenge period expires, we can resolve the channels off-chain \(with the information that we settled on-chain\) using `closeThreadContractHandler()`:

```javascript
 //Resolve virtual channels using information settled via the blockchain
 await client.closeThreadContractHandler({
    channelId: channelForAlice, // Sender's channel
    aliceToBobThread,
    sender: Alice // optional, defaults to accounts[0]
   })
```

While this ensures that Alice and Bob receive \(or pay\) the funds consistent with the most recent amount to which they agreed, it entails three on-chain transactions and is therefore a costly and time-consuming process. This discourages Alice from submitting falsified state updates.

## Closing Channels

If Alice and the hub disagree on final channel balances, the hub will not countersign the update that Alice submits using `closeChannel()` and will instead return error code `601`. To resolve the error, we will need to initiate another dispute resolution process. First, we call `updateChannelStateContractHandler()` to put the current state of the channel on the blockchain. Recall that the channel was established with an on-chain transaction, so we only need to put the most recent state on-chain rather than both states.

```javascript
//Update channel state on blockchain
const response = await client.updateChannelStateContractHandler({
        channelId: channelForAlice, 
        nonce: channelForAlice.nonce,
        balanceAlice,
        balanceHub,
        sigAlice: channelForAlice.sigAlice,
        sigHub: channelForAlice.sigHub,
        threadRootHash,
        sender: null
      })
```

This function call will initiate a challenge timer, during which Alice can attempt to submit a state update with a higher nonce. At the end of that challenge timer, funds will be distributed within the channel in accordance with the highest nonce-d state update. 

