# Making Your First Payment

## Opening a channel between the Hub and a counterparty

For ideal UX, this should be masked as "deposit into our wallet".

We can call [`openChannel()`](../client-docs-2.0.md#openchannel) to open a channel between your user and the Hub.

```javascript
// Open channel between party and Hub
async () => {
  await connext.openChannel({
    initialDeposits,            //deposit object: {weiDeposit, tokenDeposit}
    challenge,                  //timer used for disputes in seconds
    sender                      //Alice's account
  })
}
```

Opening a channel involves a transaction on the blockchain and will incur confirmation time. Use an `interval()` or other similar method to ensure that the channel has opened before moving forward in your code.

## Requesting a join from the Hub

Once a channel has been opened by a user, the user needs to request that the Hub joins it. If the user will be receiving funds, the call should include how much the Hub should stake in the channel.

```javascript
//Request that Hub joins with a deposit 
async() =>{
  await connext.requestJoinChannel({
    hubDeposit,            //deposit object: {weiDeposit, tokenDeposit}
    channelId
  });
}
```

If the hub has insufficient funds, it will return a 500 error code. 

**Note:** We are aware that this is not a secure way to request funds from the Hub. Users can "grief" the Hub by requesting that the Hub deposit a large amount, and thus run the Hub out of available collateral. We've implemented this way for simplicity, currently, but this will be patched out as soon as possible.

## Opening a Thread

Once the Hub has opened and joined channels with at least two parties \(let's call them Alice and Bob\), we can open a thread between those parties. We do this by calling [`openThread()`](../client-docs-2.0.md#openthread):

```javascript
//Open thread between Alice and Bob
async() =>{
    await connext.openThread({
        to,
        sender,
        deposit            //{ weiDeposit, tokenDeposit }
    });
} 
```

This will open a unidirectional thread from Alice to Bob, in which _she can pay him_ \(not the other way around\). If Bob wishes to pay Alice, another channel can be opened in the opposite direction \(that is, with Bob as the sender\).

Parties can have multiple threads open at once, in either direction.

## Transacting in a thread

To change the balances in our thread or channel, we call [`updateThread()`](../client-docs-2.0.md#updatebalances).  This generates, signs and sends a state update to the Hub and counterparty.

```javascript
//Update balances in thread
async() =>{
    await connext.updateThread({
        threadId,
        balanceA: { weiDeposit, tokenDeposit },
        balanceB: { weiDeposit, tokenDeposit }
    });
}
```

Threads can be updated as many times as needed and are only bounded by the quantity of funds that have been deposited.

## Closing Threads 

Threads can be closed using [`closeThread()`](../client-docs-2.0.md#closethread). Close thread will retrieve the latest mutually agreed upon state update and submit it to the Hub. If the update matches the latest update recorded by the Hub, the thread will be closed offchain.

In the event that they do not match, or if the Hub is offline, a thread can be disputed and closed onchain as well. Refer to the [Disputing a Transaction](disputing-a-transaction.md) section for more details.

```javascript
//Closing thread: Happy case
async() =>{
    await connext.closeThread(ourThread.threadId);
}
```

When the thread is closed, Bob and Alice's balances will automatically be updated in their respective channels with the Hub.

## Closing Channels

A channel can be closed and funds withdrawn when all threads have been closed. `closeChannel()` closes the channel associated with `accounts[0]`

```javascript
//Close channel: Happy case
async() =>{
    await connext.closeChannel()
}
```



