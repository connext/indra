# Connext Client Method Reference

## Table of Contents

* [Connext](client-docs-2.0.md#connext)
  * [Parameters](client-docs-2.0.md#parameters)
  * [openChannel](client-docs-2.0.md#openchannel)
  * [requestJoinChannel](client-docs-2.0.md#requestjoinchannel)
  * [deposit](client-docs-2.0.md#deposit)
  * [openThread](client-docs-2.0.md#openthread)
  * [updateChannel](client-docs-2.0.md#updatechannel)
  * [updateThread](client-docs-2.0.md#updatethread)
  * [closeThread](client-docs-2.0.md#closethread)
  * [closeThreads](client-docs-2.0.md#closethreads)
  * [closeChannel](client-docs-2.0.md#closechannel)
  * [withdraw](client-docs-2.0.md#withdraw)
  * [cosignLatestChannelUpdate](client-docs-2.0.md#cosignlatestchannelupdate)
  * [cosignChannelUpdate](client-docs-2.0.md#cosignchannelupdate)
  * [createChannelStateUpdate](client-docs-2.0.md#createchannelstateupdate)
  * [createThreadStateUpdate](client-docs-2.0.md#createthreadstateupdate)
  * [createChannelContractHandler](client-docs-2.0.md#createchannelcontracthandler)
  * [channelOpenTimeoutContractHandler](client-docs-2.0.md#channelopentimeoutcontracthandler)
  * [depositContractHandler](client-docs-2.0.md#depositcontracthandler)
  * [consensusCloseChannelContractHandler](client-docs-2.0.md#consensusclosechannelcontracthandler)
  * [joinChannelContractHandler](client-docs-2.0.md#joinchannelcontracthandler)
  * [updateChannelStateContractHandler](client-docs-2.0.md#updatechannelstatecontracthandler)
  * [initThreadContractHandler](client-docs-2.0.md#initthreadcontracthandler)
  * [settleThreadContractHandler](client-docs-2.0.md#settlethreadcontracthandler)
  * [closeThreadContractHandler](client-docs-2.0.md#closethreadcontracthandler)
  * [byzantineCloseChannelContractHandler](client-docs-2.0.md#byzantineclosechannelcontracthandler)
  * [getUnjoinedThreads](client-docs-2.0.md#getunjoinedthreads)
  * [getThreadStateByNonce](client-docs-2.0.md#getthreadstatebynonce)
  * [getChannelStateByNonce](client-docs-2.0.md#getchannelstatebynonce)
  * [getLatestChannelState](client-docs-2.0.md#getlatestchannelstate)
  * [getThreadsByChannelId](client-docs-2.0.md#getthreadsbychannelid)
  * [getThreadById](client-docs-2.0.md#getthreadbyid)
  * [getThreadByParties](client-docs-2.0.md#getthreadbyparties)
  * [getChannelById](client-docs-2.0.md#getchannelbyid)
  * [getChannelByPartyA](client-docs-2.0.md#getchannelbypartya)
  * [getLatestThreadState](client-docs-2.0.md#getlatestthreadstate)
  * [getThreadInitialStates](client-docs-2.0.md#getthreadinitialstates)
  * [getThreadInitialState](client-docs-2.0.md#getthreadinitialstate)
  * [requestHubDeposit](client-docs-2.0.md#requesthubdeposit)
  * [fastCloseThreadHandler](client-docs-2.0.md#fastclosethreadhandler)
  * [fastCloseChannelHandler](client-docs-2.0.md#fastclosechannelhandler)
  * [createChannelUpdateOnThreadOpen](client-docs-2.0.md#createchannelupdateonthreadopen)
  * [createChannelUpdateOnThreadClose](client-docs-2.0.md#createchannelupdateonthreadclose)
  * [getNewChannelId](client-docs-2.0.md#getnewchannelid)
  * [createChannelStateUpdateFingerprint](client-docs-2.0.md#createchannelstateupdatefingerprint)
  * [recoverSignerFromChannelStateUpdate](client-docs-2.0.md#recoversignerfromchannelstateupdate)
  * [createThreadStateUpdateFingerprint](client-docs-2.0.md#createthreadstateupdatefingerprint)
  * [recoverSignerFromThreadStateUpdate](client-docs-2.0.md#recoversignerfromthreadstateupdate)
  * [generateThreadRootHash](client-docs-2.0.md#generatethreadroothash)
  * [generateMerkleTree](client-docs-2.0.md#generatemerkletree)

### Connext <a id="connext"></a>

Class representing an instance of a Connext client.

#### Parameters <a id="parameters"></a>

* `$0` [**Object**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object)
  * `$0.web3`
  * `$0.hubAddress` \(optional, default `""`\)
  * `$0.hubUrl` \(optional, default `""`\)
  * `$0.contractAddress` \(optional, default `""`\)
  * `$0.hubAuth` \(optional, default `""`\)
* `web3Lib` \(optional, default `Web3`\)
* `params` [**Object**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object) the constructor object

#### openChannel <a id="openchannel"></a>

Opens a channel with the hub at the address provided when instantiating the Connext instance with the given initial deposits.

Uses the internal web3 instance to call the createChannel function on the Channel Manager contract, and logs the transaction hash of the channel creation. The function returns the ID of the created channel.

Once the channel is created on chain, users should call the requestJoinChannel function to request that the hub joins the channel with the provided deposit. This deposit is the amount the viewer anticipates others will pay them for the duration of the channel. This function should be called on a timeout sufficient for the hub to detect the channel and add it to its database.

If the hub is unresponsive, or does not join the channel within the challenge period, the client function "channelOpenTimeoutContractHandler" can be called by the client to recover the funds.

**Parameters**

* `$0` [**Object**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object)
  * `$0.initialDeposits`
  * `$0.challenge`
  * `$0.tokenAddress` \(optional, default `null`\)
  * `$0.sender` \(optional, default `null`\)
* `initialDeposits` [**Object**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object) deposits in wei \(must have at least one deposit\)
  * `initialDeposits.weiDeposit` **BN** deposit in wei \(may be null for ETH only channels\)
  * `initialDeposits.tokenDeposit` **BN** deposit in tokens \(may be null\)
* `challenge` [**Number**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number) challenge period in seconds
* `tokenAddress` [**String**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String) address of token deposit.
* `sender` [**String**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String) \(optional\) counterparty with hub in ledger channel, defaults to accounts\[0\]

**Examples**

```text
// sender must approve token transfer
// for channel manager contract address before calling
const initialDeposits = {
   tokenDeposit: Web3.utils.toBN('1000'),
   weiDeposit: Web3.utils.toBN('1000')
}
const challenge = 3600 // period to wait in disputes
const tokenAddress = '0xaacb...'
const channelId = await connext.openChannel({ initialDeposits, challenge, tokenAddress })
```

Returns [**Promise**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise) resolves to the channel id of the created channel

#### requestJoinChannel <a id="requestjoinchannel"></a>

Requests that the hub joins the channel with the provided channelId and deposits.

The requested deposit amounts should reflect the amount the channel partyA expects to be paid for the duration of the capital.

**Parameters**

* `$0` [**Object**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object)
  * `$0.hubDeposit`
  * `$0.channelId`
* `hubDeposit` [**Object**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object) \(optional\) requested deposits in the channel from the hub. Defaults to a 0 deposit.
  * `hubDeposit.weiDeposit` **BN** \(optional\) weiDeposit requested from hub
  * `hubDeposit.tokenDeposit` **BN** \(optional\) tokenDeposit requested from hub.
* `channelId` [**String**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String) channelId of the channel you would like to join.

**Examples**

```text
const channelId = await connext.openChannel({ initialDeposits, challenge, tokenAddress })
await connext.joinChannel({ channelId })
```

Returns [**Promise**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise) resolves to hubs response to the channel join.

#### deposit <a id="deposit"></a>

Adds a deposit to an existing channel by calling the contract function "deposit" using the internal web3 instance.

Can be used by any either channel party.

If sender is not supplied, it defaults to accounts\[0\]. If the recipient is not supplied, it defaults to the sender.

**Parameters**

* `deposits` [**Object**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object) deposit object
  * `deposits.weiDeposit` **BN** value of the channel deposit in ETH
  * `deposits.tokenDeposit` **BN** value of the channel deposit in tokens
* `sender` [**String**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String) \(optional\) ETH address sending funds to the ledger channel \(optional, default `null`\)
* `recipient` [**String**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String) \(optional\) ETH address recieving funds in their ledger channel \(optional, default `sender`\)
* `tokenAddress` [**String**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String) \(optional, for testing\) contract address of channel tokens. If not provided, takes from channel object. \(optional, default `null`\)

**Examples**

```text
// create deposit object
const deposits = {
   tokenDeposit: Web3.utils.toBN('1000'),
   weiDeposit: Web3.utils.toBN('1000')
}
const txHash = await connext.deposit(deposit)
```

Returns [**Promise**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise) resolves to the transaction hash of the onchain deposit.

#### openThread <a id="openthread"></a>

Opens a thread between "to" and "sender" with the hub acting as an intermediary. Both users must have a channel open with the hub.

If there is no deposit provided, then 100% of the channel balance is added to the thread. This function is to be called by the payor \(sender\), and is intended to open a unidirectional channel with the payee \(to\).

Signs a copy of the initial thread state, and generates a proposed channel update to the hub for countersigning reflecting the thread creation.

**Parameters**

* `params` [**Object**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object) the method object
  * `params.to` [**String**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String) ETH address you want to open a virtual channel with
  * `params.deposit` [**Object**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object) \(optional\) deposit object for the virtual channel, defaults to the entire channel balances \(optional, default `null`\)
    * `params.deposit.weiDeposit` [**Object**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object) \(optional\) wei deposit into thread
    * `params.deposit.weiDeposit` **BN** token deposit into thread
  * `params.sender` [**String**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String) \(optional\) who is initiating the virtual channel creation, defaults to accounts\[0\] \(optional, default `null`\)

**Examples**

```text
const myFriendsAddress = "0x627306090abaB3A6e1400e9345bC60c78a8BEf57"
await connext.openThread({ to: myFriendsAddress })
```

Returns [**Promise**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise) resolves to the virtual channel ID recieved by Ingrid

#### updateChannel <a id="updatechannel"></a>

Sends a state update in a channel. Updates of these type represent an in channel payment to or from the hub.

The balance objects represent the final balances of partyA \(balanceA\) and the hub \(balanceB\) following the update.

**Parameters**

* `params` [**Object**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object) the method object
  * `params.channelId` [**String**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String) the channelId of the channel you are updating
  * `params.balanceA` [**Object**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object) final balance of partyA in channel
    * `params.balanceA.weiDeposit` **BN** \(optional\) final wei balance of partyA in channel
    * `params.balanceA.tokenDeposit` **BN** \(optional\) final token balance of partyA in channel
  * `params.balanceB` [**Object**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object) final balance of hub in channel
    * `params.balanceB.weiDeposit` **BN** \(optional\) final wei balance of hub in channel
    * `params.balanceB.tokenDeposit` **BN** \(optional\) final token balance of hub in channel
  * `params.sender` \(optional, default `null`\)

**Examples**

```text
const { channelId } = await connext.getChannelByPartyA()
const payment = Web3.utils.toBN('10')
const balanceA = {
   tokenDeposit: Web3.utils.toBN(channel.tokenBalanceA).sub(payment),
   weiDeposit: Web3.utils.toBN(channel.weiBalanceA).sub(payment)
}
const balanceB = {
   tokenDeposit: Web3.utils.toBN(channel.tokenBalanceA).add(payment),
   weiDeposit: Web3.utils.toBN(channel.weiBalanceA).add(payment)
}
await connext.updateChannel({ channelId, balanceA, balanceB })
```

#### updateThread <a id="updatethread"></a>

Sends a state update in a thread. Updates of these type are unidirectional and can only facilitate payments from thread partyA to thread partyB.

The balance objects represent the final balances of partyA \(balanceA\) and the hub \(partyB\) following the update.

**Parameters**

* `$0` [**Object**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object)
  * `$0.threadId`
  * `$0.balanceA`
  * `$0.balanceB`
  * `$0.sender` \(optional, default `null`\)
* `threadId` [**String**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String) the threadId of the thread you are updating
* `balanceA` [**Object**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object) final balance of partyA in thread
  * `balanceA.weiDeposit` **BN** \(optional\) final wei balance of partyA in thread
  * `balanceA.tokenDeposit` **BN** \(optional\) final token balance of partyA in thread
* `balanceB` [**Object**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object) final balance of partyB in thread
  * `balanceB.weiDeposit` **BN** \(optional\) final wei balance of partyB in thread
  * `balanceB.tokenDeposit` **BN** \(optional\) final token balance of partyB in thread
* `sender` [**String**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String) \(optional\) signer of balance update, defaults to accounts\[0\]

**Examples**

```text
const { threadId } = await connext.getThreadByParties({ partyA, partyB })
const payment = Web3.utils.toBN('10')
const balanceA = {
   tokenDeposit: Web3.utils.toBN(channel.tokenBalanceA).sub(payment),
   weiDeposit: Web3.utils.toBN(channel.weiBalanceA).sub(payment)
}
const balanceB = {
   tokenDeposit: Web3.utils.toBN(channel.tokenBalanceA).add(payment),
   weiDeposit: Web3.utils.toBN(channel.weiBalanceA).add(payment)
}
await connext.updateThread({ threadId, balanceA, balanceB })
```

#### closeThread <a id="closethread"></a>

Closes a thread. May be called by either member of the thread.

Retrieves the latest thread update, and decomposes it into the final channel updates for the subchans.

The thread agent who called this function signs the closing channel update, and forwards the signature to the hub.

The hub verifies the signature, returns its signature of the channel update, and proposes the corresponding update for the other thread participant.

If the hub does not cosign the proposed channel update, the caller may enter the on-chain dispute phase calling updateChannelState, initThread, settleThread, and withdraw.

**Parameters**

* `threadId` [**String**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String) ID of the thread to close
* `sender` [**String**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String) \(optional\) sender of the closeThread account. Default to accounts\[0\]. Must be partyA or partyB in thread. \(optional, default `null`\)

**Examples**

```text
const { threadId } = await connext.getThreadByParties({ partyA, partyB })
await connext.closeThread(threadId)
```

Returns [**Promise**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise) resolves to true if the thread was closed otherwise throws an error

#### closeThreads <a id="closethreads"></a>

Closes many threads by calling closeThread on each threadID in the provided array.

**Parameters**

* `threadIds` [**Array**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Array)**&lt;**[**String**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)**&gt;** array of virtual channel IDs you wish to close
* `sender` [**String**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String) \(optional\) sender of closeThreads call, must be partyA or partyB in thread. Defaults to accounts\[0\] \(optional, default `null`\)

**Examples**

```text
const threads = [
    0xasd310..,
    0xadsf11..,
]
await connext.closeThreads(channels)
```

#### closeChannel <a id="closechannel"></a>

Closes an existing channel.

All threads must be closed before a channel can be closed.

Generates the state update from the latest hub signed state with fast-close flag.

The hub countersigns the closing update if it matches what has been signed previously, and the channel will fast close by calling consensusCloseChannel on the contract.

If the state update doesn't match what the hub previously signed, an error is thrown and the wallet should enter the dispute fase by calling updateChannelState with the fastCloseFlad, then withdraw.

**Parameters**

* `sender` [**String**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String) \(optional\) who the transactions should be sent from, defaults to accounts\[0\] \(optional, default `null`\)

**Examples**

```text
const success = await connext.closeChannel()
```

Returns [**Promise**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise) resolves to the on chain transaction hash of the consensusClose function

#### withdraw <a id="withdraw"></a>

Withdraws bonded funds from channel after a channel it is challenge closed and the dispute timer has elapsed.

**Parameters**

* `sender` [**String**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String) \(optional\) the person sending the on chain transaction, defaults to accounts\[0\] \(optional, default `null`\)

**Examples**

```text
try {
  const success = await connext.closeChannel(channelId)
} catch (e) {
  if (e.statusCode === 601) {
     await connext.updateChannelState()
     // wait out challenge period
     await connext.withdraw()
  }
}
```

Returns [**Promise**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise) resolves to the transaction hash from calling byzantineCloseChannels

#### cosignLatestChannelUpdate <a id="cosignlatestchannelupdate"></a>

Verifies and cosigns the latest channel state update.

**Parameters**

* `channelId` [**String**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String) channel id
* `sender` [**String**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String) \(optional\) the person who cosigning the update, defaults to accounts\[0\] \(optional, default `null`\)

**Examples**

```text
const { channelId } = await connext.getChannelIdByPartyA()
await connext.cosignLatestChannelUpdate(channelId)
```

Returns [**Promise**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise) resolves to the cosigned channel state update

#### cosignChannelUpdate <a id="cosignchannelupdate"></a>

Verifies and cosigns the channel state update indicated by the provided nonce.

**Parameters**

* `params` [**Object**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object) the method object
  * `params.channelId` [**String**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String) channel id
  * `params.nonce` [**Number**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number) nonce of update you would like to cosign
  * `params.sender` [**String**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String) \(optional\) the person who cosigning the update, defaults to accounts\[0\] \(optional, default `null`\)

**Examples**

```text
const { channelId } = await connext.getChannelIdByPartyA()
const nonce = 4
await connext.cosignLatestChannelUpdate({ channelId, nonce })
```

Returns [**Promise**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise) resolves to the cosigned ledger channel state update

#### createChannelStateUpdate <a id="createchannelstateupdate"></a>

Generates a signed channel state update.

**Parameters**

* `params` [**Object**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object) the method object
  * `params.isClose` [**Boolean**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Boolean) \(optional\) flag indicating whether or not this is closing state, defaults to false \(optional, default `false`\)
  * `params.channelId` [**String**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String) ID of the channel you are updating
  * `params.nonce` [**Number**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number) the sequence of update
  * `params.numOpenThread` [**Number**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number) the number of open threads associated with this channel
  * `params.threadRootHash` [**String**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String) the root hash of the Merkle tree containing all initial states of the open threads
  * `params.partyA` [**String**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String) ETH address of partyA in the channel
  * `params.partyI` [**String**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String) \(optional\) ETH address of the hub, defaults to this.hubAddress \(optional, default `this.hubAddress`\)
  * `params.balanceA` [**Object**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object) updated balance of partyA
    * `params.balanceA.weiDeposit` **BN** \(optional\) final wei balance of partyA in channel
    * `params.balanceA.tokenDeposit` **BN** \(optional\) final token balance of partyA in channel
  * `params.balanceI` [**Object**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object) final balance of hub in channel
    * `params.balanceI.weiDeposit` **BN** \(optional\) final wei balance of hub in channel
    * `params.balanceI.tokenDeposit` **BN** \(optional\) final token balance of hub in channel
  * `params.unlockedAccountPresent` [**Boolean**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Boolean) \(optional\) whether to use sign or personal sign, defaults to false if in prod and true if in dev \(optional, default `process.env.DEV?process.env.DEV:false`\)
  * `params.signer` [**String**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String) \(optional\) ETH address of person signing data, defaults to account\[0\] \(optional, default `null`\)
  * `params.hubBond` [**Object**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object) \(optional\) should be supplied if creating or closing a thread \(optional, default `null`\)
  * `params.deposit` [**Object**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object) \(optional\) should be supplied if creating a deposit into a channel \(optional, default `null`\)

Returns [**String**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String) signature of signer on data provided

#### createThreadStateUpdate <a id="createthreadstateupdate"></a>

Creates a signed thread state update

**Parameters**

* `params` [**Object**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object) the method object
  * `params.channelId` [**String**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String) ID of the thread you are updatign
  * `params.nonce` [**Number**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number) the sequence of the state update
  * `params.partyA` [**String**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String) ETH address of partyA
  * `params.partyB` [**String**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String) ETH address of partyB
  * `params.balanceA` [**Number**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number) updated balance of partyA
    * `params.balanceA.weiDeposit` **BN** updated party A wei balance
    * `params.balanceA.tokenDeposit` **BN** updated partyA token balance
  * `params.balanceB` [**Object**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object) updated partB balance object
    * `params.balanceB.weiDeposit` **BN** updated partyB wei balance
    * `params.balanceB.tokenDeposit` **BN** updated partyB token balance
  * `params.unlockedAccountPresent` [**Boolean**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Boolean) \(optional\) whether to use sign or personal sign, defaults to false if in prod and true if in dev \(optional, default `process.env.DEV?process.env.DEV:false`\)
  * `params.signer` [**String**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String) \(optional\) ETH address of person signing data, defaults to account\[0\] \(optional, default `null`\)
  * `params.updateType`

Returns [**String**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String) signature of signer on data provided

#### createChannelContractHandler <a id="createchannelcontracthandler"></a>

Calls createChannel on the Channel Manager contract.

**Parameters**

* `params` [**Object**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object) the method object
  * `params.hubAddress` [**String**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String) \(optional\) defaults to the address supplied on init \(optional, default `this.hubAddress`\)
  * `params.channelId` [**String**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String) channelId, should be generated using Connext static functions
  * `params.initialDeposits` [**Object**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object) ,
  * `params.challenge` [**Number**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number) challenge period in seconds
  * `params.tokenAddress` [**String**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String) \(optional\) tokenAddress for the tokens you would like to bond in the channel. Do not supply for an ETH only channel \(optional, default `null`\)
  * `params.sender` [**String**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String) \(optional\) the account that will create the channel \(channel.partyA\). Defaults to accounts\[0\] \(optional, default `null`\)
  * `params.channelType`

**Examples**

```text
// wallet must approve token transfer to contract
// before creating a TOKEN or ETH-TOKEN channel
const channelId = Connext.getNewChannelId()
const initialDeposits = {
   weiDeposit: Web3.utils.toBN('100'),
   tokenDeposit: Web3.utils.toBN('100'),
}
const challenge = 3600
const tokenAddress = "0xaa..."
await connext.crateChannelContractHandler({ initialDeposits, channelId, challenge, tokenAddress })
```

Returns [**Promise**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise) resolves to the result of the contract call

#### channelOpenTimeoutContractHandler <a id="channelopentimeoutcontracthandler"></a>

Users should use this to recover bonded funds if the hub fails to join the ledger channel within the challenge window.

**Parameters**

* `channelId` [**String**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String) channel id the hub did not join
* `sender` [**String**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String) \(optional\) who is calling the transaction \(defaults to accounts\[0\]\). Should be partyA in unjoined channel \(optional, default `null`\)

Returns [**Promise**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise) resolves to the result of the contract call

#### depositContractHandler <a id="depositcontracthandler"></a>

Calls the contracts "deposit" method to deposit into an open channel. Wallet should approve the transfer to the contract of any deposited tokens before calling this method.

You can deposit wei or tokens, but should call deposit separately to deposit both into a channel.

**Parameters**

* `params` [**Object**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object) the method object
  * `params.deposits` [**Object**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object) the channel deposits
    * `params.deposits.weiDeposit` **BN** \(optional\) wei deposit into channel
    * `params.deposits.tokenDeposit` **BN** \(optional\) token deopsit into channel
  * `params.sender` [**String**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String) \(optional\) the sender of the deposit. Defaults to accounts\[0\] \(optional, default `null`\)
  * `params.recipient` [**String**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String) \(optional\) the recipient of the deposit. Defaults to sender or accounts\[0\] \(optional, default `sender`\)
  * `params.channelId`

Returns [**Promise**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise) resolves to the result of the contract call

#### consensusCloseChannelContractHandler <a id="consensusclosechannelcontracthandler"></a>

Calls consensusCloseChannel on the ChannelManager contract.

**Parameters**

* `params` [**Object**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object) the method object
  * `params.nonce` [**Number**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number) the closing channel nonce
  * `params.balanceA` [**Object**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object) the closing partyA balance
    * `params.balanceA.weiDeposit` **BN** \(optional\) final wei balance of partyA in channel
    * `params.balanceA.tokenDeposit` **BN** \(optional\) final token balance of partyA in channel
  * `params.balanceI` [**Object**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object) final balance of hub in channel
    * `params.balanceI.weiDeposit` **BN** \(optional\) final wei balance of hub in channel
    * `params.balanceI.tokenDeposit` **BN** \(optional\) final token balance of hub in channel
  * `params.sigA` [**String**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String) partyA's closing signature with the fast close flag
  * `params.sigI` [**String**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String) the hub's closing signature with the fast close flag
  * `params.sender` [**String**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String) \(optional\) the sender of the contract call, defaults to accounts\[0\] \(optional, default `null`\)
  * `params.channelId`

**Examples**

```text
// generate final state sigParams
const sig = await connext.createChannelStateUpdate(sigParams);
const { sigI } = await connext.fastCloseChannelHandler({
  sig,
  channelId: channel.channelId
});
await connext.conensusCloseChannelContractHandler({
  channelId: sigParams.channelId,
  nonce: sigParams.nonce,
  balanceA: sigParams.balanceA,
  balanceI: sigParams.balanceI,
  sigA,
  sigI
})
```

Returns [**Promise**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise) resolves to the result of the contract call

#### joinChannelContractHandler <a id="joinchannelcontracthandler"></a>

Calls joinChannel on the Channel Manager contract with the provided deposits. If no deposits are provided, joins with 0 deposits.

The wallet must approve the transfer of the deposited tokens to the Channel Manager contract before calling this function.

Calling this function will also serve you to serve as a "hub" in the contract.

**Parameters**

* `params` [**Object**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object) the method object
  * `params.channelId` [**String**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String) the channelId of the channel you are joining
  * `params.deposits` [**Object**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object) \(optional\) the deposits you are joining the channel with. Default value is 0. \(optional, default `null`\)
    * `params.deposits.weiDeposit` **BN** \(optional\) initial wei deposit into channel
    * `params.deposits.tokenDeposit` **BN** \(optional\) initial token deposit into channel
  * `params.sender` \(optional, default `null`\)

**Examples**

```text
// approve token transfers
const { channelId } = await connext.getChannelByPartyA("0x3ae...")
await connext.joinChannelContractHandler({ channelId })
```

Returns [**Promise**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise) resolves to the result of the contract call

#### updateChannelStateContractHandler <a id="updatechannelstatecontracthandler"></a>

Calls updateChannelState on the Channel Manager contract. Should be called if there is a dispute when fast closing a channel, or when you are beginning to dispute a thread.

**Parameters**

* `params` [**Object**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object) the method object
  * `params.channelId` [**String**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String) ID of the channel you are disputing
  * `params.nonce` [**Number**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number) the nonce of the state you are submitting to the contract
  * `params.numOpenThread` [**Number**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number) the number of open threads in that channel state
  * `params.threadRootHash` [**String**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String) root hash of the initial thread states for active threads in this channel
  * `params.balanceA` [**Object**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object) partyA balance
    * `params.balanceA.weiDeposit` **BN** \(optional\) wei balance of partyA in channel
    * `params.balanceA.tokenDeposit` **BN** \(optional\) token balance of partyA in channel
  * `params.balanceI` [**Object**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object) balance of hub in channel
    * `params.balanceI.weiDeposit` **BN** \(optional\) wei balance of hub in channel
    * `params.balanceI.tokenDeposit` **BN** \(optional\) token balance of hub in channel
  * `params.sigA` [**String**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String) partyA's signature on the state
  * `params.sigI` [**String**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String) the hub signature on the state
  * `params.sender` [**String**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String) \(optional\) sender of the contract call. Defaults to accounts\[0\] \(optional, default `null`\)

**Examples**

```text
// generate final state sigParams
const sig = await connext.createChannelStateUpdate(sigParams);
const { sigI } = await connext.fastCloseChannelHandler({
  sig,
  channelId: channel.channelId
});
if (!sigI) {
 const { channelId, nonce, numOpenThread, balanceA, balanceI, threadRootHash } = sigParams
 await connext.this.updateChannelStateContractHandler({ channelId, nonce, numOpenThread, balanceA, balanceI, threadRootHash })
}
```

Returns [**Promise**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise) resolves to the result of the contract call

#### initThreadContractHandler <a id="initthreadcontracthandler"></a>

Calls initThreadState on the Channel Manager contract. Should be called if there is a dispute when closing a thread, after updateChannelState has timed out.

**Parameters**

* `params` [**Object**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object) the method object
  * `params.subchanId` [**String**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String) ID of the your subchannel in thread
  * `params.threadId` [**String**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String) ID of the thread you are disputing
  * `params.proof` [**String**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String) \(optional\) the proof the thread is in the on-chain root hash of the channel. If not provided, it is generated. \(optional, default `null`\)
  * `params.partyA` [**String**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String) partyA in thread \(payor\)
  * `params.partyB` [**String**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String) partyB in thread \(payee\)
  * `params.balanceA` [**Object**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object) partyA balance
    * `params.balanceA.weiDeposit` **BN** \(optional\) wei balance of partyA in channel
    * `params.balanceA.tokenDeposit` **BN** \(optional\) token balance of partyA in channel
  * `params.sigA` [**String**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String) partyA's signature on the initial thread state
  * `params.sender` [**String**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String) \(optional\) sender of the contract call. Defaults to accounts\[0\] \(optional, default `null`\)

Returns [**Promise**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise) resolves to the result of the contract call

#### settleThreadContractHandler <a id="settlethreadcontracthandler"></a>

Calls settleThread on the Channel Manager contract. Should be called if there is a dispute when closing a thread, after initThread has timed out.

**Parameters**

* `params` [**Object**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object) the method object
  * `params.subchanId` [**String**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String) ID of the your subchannel in thread
  * `params.threadId` [**String**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String) ID of the thread you are disputing
  * `params.nonce` [**Number**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number) nonce of the state you are putting on-chain
  * `params.partyA` [**String**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String) partyA in thread \(payor\)
  * `params.partyB` [**String**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String) partyB in thread \(payee\)
  * `params.balanceA` [**Object**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object) partyA balance
    * `params.balanceA.weiDeposit` **BN** \(optional\) wei balance of partyA in channel
    * `params.balanceA.tokenDeposit` **BN** \(optional\) token balance of partyA in channel
  * `params.balanceB` [**Object**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object) partyB balance
    * `params.balanceB.weiDeposit` **BN** \(optional\) wei balance of partyB in channel
    * `params.balanceB.tokenDeposit` **BN** \(optional\) token balance of partyB in channel
  * `params.sigA` [**String**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String) partyA's signature on the provided thread state
  * `params.sender` [**String**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String) \(optional\) sender of the contract call. Defaults to accounts\[0\] \(optional, default `null`\)

Returns [**Promise**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise) resolves to the result of the contract call

#### closeThreadContractHandler <a id="closethreadcontracthandler"></a>

Calls closeThread on the Channel Manager contract. Reintroduces the funds to their respective channels. Should be called after the settleThread dispute time has elapsed.

**Parameters**

* `params` [**Object**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object) the method object
  * `params.channelId` [**String**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String) the ID of the disputer's channel
  * `params.threadId` [**String**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String) the ID of the disputed thread
  * `params.sender` [**String**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String) \(optional\) the sender of the contract call, defaults to accounts\[0\] \(optional, default `null`\)

Returns [**Promise**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise) resolves to the result of the contract call

#### byzantineCloseChannelContractHandler <a id="byzantineclosechannelcontracthandler"></a>

Calls byzantineCloseChannel on the Channel Manager contract. Withdraws the funds from, and closes out, a disputed channel. Should be called after the updateChannelState dispute time has elapsed, and when there are no threads remaining open.

**Parameters**

* `params` [**Object**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object) the method object
  * `params.channelId` [**String**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String) the ID of the disputer's channel
  * `params.sender` [**String**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String) \(optional\) the sender of the contract call, defaults to accounts\[0\] \(optional, default `null`\)
  * `params.threadId` [**String**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String) the ID of the disputed thread

Returns [**Promise**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise) resolves to the result of the contract call

#### getUnjoinedThreads <a id="getunjoinedthreads"></a>

Requests the unjoined threads that have been initiated. All threads are unidirectional, and only the reciever of payments may have unjoined threads.

In reality, partyB does not have to explicitly join threads as they are unidirectional, so all threads may be unjoined.

**Parameters**

* `partyB` [**String**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String) \(optional\) ETH address of party who has yet to join threads. \(optional, default `null`\)

Returns [**Promise**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise) resolves to an array of unjoined virtual channel objects

#### getThreadStateByNonce <a id="getthreadstatebynonce"></a>

Returns the thread state at a given nonce.

**Parameters**

* `params` [**Object**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object) the method object
  * `params.threadId` [**String**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String) the ID of the thread
  * `params.nonce` [**Number**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number) the desired state's nonce

Returns [**Promise**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise) resolves to the thread state at the given nonce

#### getChannelStateByNonce <a id="getchannelstatebynonce"></a>

Returns the channel state at a given nonce.

**Parameters**

* `params` [**Object**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object) the method object
  * `params.nonce` [**Number**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number) the desired state's nonce
  * `params.channel` [**String**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String) the ID of the channel
  * `params.channelId`

Returns [**Promise**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise) resolves to the channel state at the given nonce

#### getLatestChannelState <a id="getlatestchannelstate"></a>

Returns the latest channel state.

**Parameters**

* `channelId` [**String**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String) the ID of the thread

Returns [**Promise**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise) resolves to the latest channel state

#### getThreadsByChannelId <a id="getthreadsbychannelid"></a>

Returns an array of the threads associated with the given channel.

**Parameters**

* `channelId` [**String**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String) ID of the ledger channel

Returns [**Promise**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise) resolves to an array of thread objects

#### getThreadById <a id="getthreadbyid"></a>

Returns the thread.

**Parameters**

* `threadId` [**String**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String) the ID of the thread

Returns [**Promise**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise) resolves to the thread object

#### getThreadByParties <a id="getthreadbyparties"></a>

Returns the threads between the two parties. If there are no threads, returns null.

**Parameters**

* `params` [**Object**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object) the method object
  * `params.partyA` [**String**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String) ETH address of partyA in virtual channel
  * `params.partyB` [**String**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String) ETH address of partyB in virtual channel

Returns [**Promise**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise) resolves to the thread

#### getChannelById <a id="getchannelbyid"></a>

Returns an object representing a channel.

**Parameters**

* `channelId` [**String**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String) the ledger channel id

Returns [**Promise**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise) resolves to the ledger channel object

#### getChannelByPartyA <a id="getchannelbypartya"></a>

Returns the channel between partyA and the hub.

**Parameters**

* `partyA` [**String**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String) \(optional\) partyA in ledger channel. Default is accounts\[0\] \(optional, default `null`\)

Returns [**Promise**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise) resolves to channel object

#### getLatestThreadState <a id="getlatestthreadstate"></a>

Returns the latest thread state of the given threadId.

**Parameters**

* `threadId` [**String**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String) ID of thread

Returns [**Promise**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise) resolves to thread state

#### getThreadInitialStates <a id="getthreadinitialstates"></a>

Returns the initial thread states for all open threads associated with the channelId.

**Parameters**

* `channelId` [**String**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String) ID of channel

Returns [**Promise**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise) resolves to an array of initial thread states

#### getThreadInitialState <a id="getthreadinitialstate"></a>

Returns the initial state of the thread

**Parameters**

* `threadId` [**String**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String) ID of thread

Returns [**Promise**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise) resolves to a thread state object

#### requestHubDeposit <a id="requesthubdeposit"></a>

Requests hub deposits into a given channel. Hub must have sufficient balance in the "B" subchannel to cover the thread balance of "A".

This function is to be used if the hub has insufficient balance in the channel to create proposed threads.

**Parameters**

* `params` [**Object**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object) the method object
  * `params.channelId` [**String**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String) id of the ledger channel
  * `params.deposit` [**Object**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object) the requested hub deposit
    * `params.deposit.weiDeposit` [**Object**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object) \(optional\) the requested hub wei deposit
    * `params.deposit.tokenDeposit` [**Object**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object) \(optional\) the requested hub token deposit

Returns [**Promise**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise) resolves to the transaction hash of Ingrid calling the deposit function

#### fastCloseThreadHandler <a id="fastclosethreadhandler"></a>

Posts a request to the hub to close a thread.

**Parameters**

* `params` [**Object**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object)
  * `params.sig` [**String**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String) the sig on the proposed subchannel update
  * `params.threadId` [**String**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String) ID of the thread you are closing
  * `params.signer` [**String**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String) \(optional\) signer of the update \(should be partyA in thread\) \(optional, default `null`\)

Returns [**Promise**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise) resolves to true if the thread was closed, false if it was not

#### fastCloseChannelHandler <a id="fastclosechannelhandler"></a>

Posts a request to the hub to cosign a final channel update with the fast close flag. Hub will only cosign if there are no threads open, and all updates are in sync.

**Parameters**

* `params` [**Object**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object)
  * `params.sig` [**String**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String) the sig on the proposed subchannel update
  * `params.channelId` [**String**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String) ID of the channel you are closing

Returns [**Promise**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise) resolves to the final cosigned state

#### createChannelUpdateOnThreadOpen <a id="createchannelupdateonthreadopen"></a>

Creates a signed channel update when a thread is opened.

**Parameters**

* `params` [**Object**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object) the method object
  * `params.threadInitialState` [**Object**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object) the initial state of the proposed thread
  * `params.signer` [**String**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String) \(optional\) signer of update. Defaults to accounts\[0\] \(optional, default `null`\)
  * `params.channel` [**Object**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object) the signer's subchannel of the proposed thread
  * `params.subchan`

Returns [**Promise**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise) resolves to the signature of the signer on the channel update

#### createChannelUpdateOnThreadClose <a id="createchannelupdateonthreadclose"></a>

Creates a signed channel update when a thread is closed.

**Parameters**

* `params` [**Object**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object) the method object
  * `params.latestThreadState` [**Object**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object) the closing state of the proposed thread
  * `params.subchan` [**Object**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object) the signer's subchannel of the thread
  * `params.signer` [**String**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String) \(optional\) signer of update. Defaults to accounts\[0\] \(optional, default `null`\)

Returns [**Promise**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise) resolves to the signature of the signer on the channel update

#### getNewChannelId <a id="getnewchannelid"></a>

Returns a new channel id that is a random hex string.

Returns [**String**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String) a random 32 byte channel ID.

#### createChannelStateUpdateFingerprint <a id="createchannelstateupdatefingerprint"></a>

Hashes the channel state using web3's soliditySha3.

**Parameters**

* `params` [**Object**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object) the method object \(representing channel state\)
  * `params.channelId` [**String**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String) channelId
  * `params.isClose` [**Boolean**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Boolean) flag indicating whether or not this is closing state
  * `params.nonce` [**Number**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number) the sequence of the channel update
  * `params.numOpenThread` [**Number**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number) the number of open threads associated with this channel
  * `params.threadRootHash` [**String**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String) the root hash of the Merkle tree containing all initial states of the open threads
  * `params.partyA` [**String**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String) ETH address of partyA in the channel
  * `params.partyI` [**String**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String) ETH address of the hub
  * `params.weiBalanceA` **BN** wei balance of partyA
  * `params.weiBalanceI` **BN** wei balance of hub
  * `params.tokenBalanceA` **BN** wei balance of partyA
  * `params.tokenBalanceI` **BN** wei balance of hub

Returns [**String**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String) the hash of the state data

#### recoverSignerFromChannelStateUpdate <a id="recoversignerfromchannelstateupdate"></a>

Recovers the signer from the hashed data generated by the Connext.createChannelStateUpdateFingerprint function.

**Parameters**

* `params` [**Object**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object) the method object \(representing channel state\)
  * `params.sig` [**String**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String) signature you are recovering signer from
  * `params.channelId` [**String**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String) channelId
  * `params.isClose` [**Boolean**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Boolean) flag indicating whether or not this is closing state
  * `params.nonce` [**Number**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number) the sequence of the channel update
  * `params.numOpenThread` [**Number**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number) the number of open threads associated with this channel
  * `params.threadRootHash` [**String**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String) the root hash of the Merkle tree containing all initial states of the open threads
  * `params.partyA` [**String**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String) ETH address of partyA in the channel
  * `params.partyI` [**String**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String) ETH address of the hub
  * `params.weiBalanceA` **BN** wei balance of partyA
  * `params.weiBalanceI` **BN** wei balance of hub
  * `params.tokenBalanceA` **BN** wei balance of partyA
  * `params.tokenBalanceI` **BN** wei balance of hub

Returns [**String**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String) the ETH address of the signer of this update.

#### createThreadStateUpdateFingerprint <a id="createthreadstateupdatefingerprint"></a>

Hashes data from a thread state update using web3's soliditySha3.

**Parameters**

* `params` [**Object**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object) the method object
  * `params.channelId` [**String**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String) ID of the thread you are creating a state update for
  * `params.nonce` [**Number**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number) the sequence of the state update
  * `params.partyA` [**String**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String) ETH address of partyA
  * `params.partyB` [**String**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String) ETH address of partyB
  * `params.weiBalanceA` **BN** wei balance of partyA
  * `params.weiBalanceB` **BN** wei balance of partyB
  * `params.tokenBalanceA` **BN** wei balance of partyA
  * `params.tokenBalanceB` **BN** wei balance of partyB
  * `params.weiBond` **BN** total wei amount in thread
  * `params.tokenBond` **BN** total token amount in thread

Returns [**String**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String) hash of the thread state

#### recoverSignerFromThreadStateUpdate <a id="recoversignerfromthreadstateupdate"></a>

Recovers the signer from the hashed data generated by the Connext.createThreadStateUpdateFingerprint function.

**Parameters**

* `params` [**Object**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object) the method object
  * `params.sig` [**String**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String) signature you are recovering signer from
  * `params.channelId` [**String**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String) ID of the thread you are creating a state update for
  * `params.nonce` [**Number**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number) the sequence of the state update
  * `params.partyA` [**String**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String) ETH address of partyA
  * `params.partyB` [**String**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String) ETH address of partyB
  * `params.weiBalanceA` **BN** wei balance of partyA
  * `params.weiBalanceB` **BN** wei balance of partyB
  * `params.tokenBalanceA` **BN** wei balance of partyA
  * `params.tokenBalanceB` **BN** wei balance of partyB
  * `params.weiBond` **BN** total wei amount in thread
  * `params.tokenBond` **BN** total token amount in thread

Returns [**String**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String) ETH address of the signer

#### generateThreadRootHash <a id="generatethreadroothash"></a>

Creates a hash of the thread initial states provided.

**Parameters**

* `threadInitialStates` [**Array**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Array)**&lt;**[**Object**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object)**&gt;** an array of initial thread states.
  * `threadInitialStates.threadInitialStates`

**Examples**

```text
const threadInitialStates = await connext.getThreadInitialStates(channelId)
const threadRootHash = Connext.generateThreadRootHash({ threadInitialStates })
```

#### generateMerkleTree <a id="generatemerkletree"></a>

Creates a merkle tree of the thread initial states provided.

**Parameters**

* `threadInitialStates` [**Array**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Array)**&lt;**[**Object**](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object)**&gt;** an array of initial thread state objects

**Examples**

```text
const threadInitialStates = await connext.getThreadInitialStates(channelId)
const mt = Connext.generateMerkleTree(threadInitialStates)
```

