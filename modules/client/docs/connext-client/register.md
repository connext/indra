# openThread

**connext.openThread\(**initialDeposit, sender, challenge**\)**⇒ `Promise`Opens a channel with the Hub at the address provided when instantiating the Connext instance with the given initial deposit.

Sender defaults to accounts\[0\] if not supplied to the register function.

Channel challenge timer is determined by the Hub if the parameter is not supplied. Current default value is 3600s \(1 hour\).

Uses the internal web3 instance to call the createChannel function on the Channel Manager contract, and logs the transaction hash of the channel creation. The function returns the ID of the created channel.

Once the channel is created on chain, users should call the requestjoinThread function to request that the hub join the channel. This function should be called on a timeout sufficient for the hub to detect the channel and add it to its database.

If the Hub is unresponsive, or does not join the channel within the challenge period, the client function "ChannelOpenTimeoutContractHandler" can be called by the client to recover the funds.

**Kind**: instance method of [`Connext`](./#Connext)  
**Returns**: `Promise` - resolves to the channel id of the created channel

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| initialDeposit | `BN` |  | deposit in wei |
| sender | `String` |  | \(optional\) counterparty with hub in channel, defaults to accounts\[0\] |
| challenge | `Number` |  | \(optional\) challenge period in seconds |

**Example**

```javascript
const deposit = Web3.utils.toBN(Web3.utils.toWei('1', 'ether))
const ChannelId = await connext.openThread(deposit)
```

