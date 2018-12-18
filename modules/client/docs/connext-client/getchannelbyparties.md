# getThreadByParties

**connext.getThreadByParties\(**params**\)** ⇒ `Promise`Returns an object representing the open thread between the two parties in the database.

**Kind**: instance method of [`Connext`](./#Connext)  
**Returns**: `Promise` - resolves to the thread

| Param | Type | Description |
| --- | --- | --- |
| params | `Object` | the method object |
| params.partyA | `String` | ETH address of partyA in thread |
| params.partyB | `String` | ETH address of partyB in thread |

