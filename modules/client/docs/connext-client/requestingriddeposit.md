# requestHubDeposit

**connext.requestHubDeposit\(**params**\)** ⇒ `Promise`Requests Hub deposits into a given subchannel. The Hub must have sufficient balance in the "B" subchannel to cover the thread balance of "A" since the Hub is assuming the financial counterparty risk.

This function is to be used if the hub has insufficient balance in the channel to create proposed threads.

**Kind**: instance method of [`Connext`](./#Connext)  
**Returns**: `Promise` - resolves to the transaction hash of Ingrid calling the deposit function

| Param | Type | Description |
| --- | --- | --- |
| params | `Object` | the method object |
| params.channlId | `String` | id of the channel |
| params.deposit | `BN` | the deposit in Wei |

