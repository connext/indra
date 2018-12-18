# openThread

**connext.openThread\(**params**\)** ⇒ `Promise`Opens a thread between "to" and sender with the hub as an intermediary. Both users must have a channel open with the Hub.

If there is no deposit provided, then 100% of the channel balance is added to thread deposit. This function is to be called by the "A" party in a unidirectional scheme.

Signs a copy of the initial thread state, and generates a proposed channel update to the hub for countersigning that updates the number of open thread and the root hash of the channel state.

This proposed state update serves as the opening certificate for the thread, and is used to verify the Hub agreed to facilitate the creation of the thread and take on the counterparty risk.

**Kind**: instance method of [`Connext`](./#Connext)  
**Returns**: `Promise` - resolves to the thread ID recieved by Ingrid

| Param | Type | Description |
| --- | --- | --- |
| params | `Object` | the method object |
| params.to | `String` | ETH address you want to open a thread with |
| params.deposit | `BN` | \(optional\) deposit in wei for the thread, defaults to the entire Channel balance |
| params.sender | `String` | \(optional\) who is initiating the thread creation, defaults to accounts\[0\] |

**Example**

```javascript
const myFriendsAddress = "0x627306090abaB3A6e1400e9345bC60c78a8BEf57"
await connext.openThread({ to: myFriendsAddress })
```

