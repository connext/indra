# ChannelOpenTimeoutContractHandler

**connext.ChannelOpenTimeoutContractHandler\(**channelId, sender**\)** ⇒ `Promise`Watchers or users should call this to recover bonded funds if the Hub fails to join the channel within the challenge window.

**Kind**: instance method of [`Connext`](./#Connext)  
**Returns**: `Promise` - resolves to the result of sending the transaction

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| channelId | `String` |  | channel id the hub did not join |
| sender | `String` |  | \(optional\) who is calling the transaction \(defaults to accounts\[0\]\) |

