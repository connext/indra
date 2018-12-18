# getChannelByPartyA

**connext.getChannelByPartyA\(**partyA, status**\)** ⇒ `Promise`Returns the channel id between the supplied address and the Hub.

If no address is supplied, accounts\[0\] is used as partyA.

**Kind**: instance method of [`Connext`](./#Connext)  
**Returns**: `Promise` - resolves to either the channel id between hub and supplied partyA, or an Array of the channel IDs between hub and partyA.

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| partyA | `String` |  | \(optional\) address of the partyA in the channel with the Hub. |
| status | `Number` |  | \(optional\) state of thread, can be 0 \(opening\), 1 \(opened\), 2 \(settling\), or 3 \(settled\). Defaults to open channel. |

 

connext.getChannelByPartyA\(partyA, status\) ⇒ `Promise`Returns object representing the channel between partyA and the Hub

**Kind**: instance method of [`Connext`](./#Connext)  
**Returns**: `Promise` - resolves to channel object

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| partyA | `String` |  | \(optional\) partyA in channel. Default is accounts\[0\] |
| status | `Number` |  | \(optional\) state of thread, can be 0 \(opening\), 1 \(opened\), 2 \(settling\), or 3 \(settled\). Defaults to open channel. |

