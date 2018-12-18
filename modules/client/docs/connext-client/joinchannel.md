# joinThread

**connext.joinThread\(**channelId, sender**\)** ⇒ `Promise`Joins thread with provided channelId with a deposit of 0 \(unidirectional channels\).

This function is to be called by the "B" party in a unidirectional scheme.

**Kind**: instance method of [`Connext`](./#Connext)  
**Returns**: `Promise` - resolves to the thread ID

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| threadId | `String` |  | ID of the thread |
| sender | `String` |  | \(optional\) ETH address of the person joining the thread \(partyB\) |

**Example**

```javascript
const channelId = 10 // pushed to partyB from Hub
await connext.joinThread(channelId)
```



