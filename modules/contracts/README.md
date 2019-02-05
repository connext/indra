
(Fully updated 11/21/2018)

# Running the test suite

Use the scripts in the package.json to ensure the proper test environment:

    # Node and npm versions:
    # node >= v10
    # npm >= v6
    
    # update the connext client repo
    $ cd client
    $ npm i

    # install the dev dependencies
    # run ganache in the background (or separate shell) ensuring the proper mnemonic
    # run the primary test suite using truffle network=ganache settings

    $ npm i
    $ npm run ganache &
    $ npm test

You can debug the test suite using chrome dev tools:

    $ npm run test:debug

    # browse to chrome://inspect

# DOCUMENT FOR CONTRACT SPEC

Canonical links: [https://paper.dropbox.com/doc/SpankPay-BOOTY-Drop-2-CANONICAL-URLs--AP7jZj1zm4J7XSVcw0Ifk_fBAg-Qpw2NAWgCIdg0Z5G9lpSu](https://paper.dropbox.com/doc/SpankPay-BOOTY-Drop-2-CANONICAL-URLs--AP7jZj1zm4J7XSVcw0Ifk_fBAg-Qpw2NAWgCIdg0Z5G9lpSu)

Hub/Wallet API spec:

[https://paper.dropbox.com/doc/SpankPay-BOOTY-Drop-2-Hub-Client-APIs--AP3nxlvN~p_IZ_a8UR2C~qshAg-Xon50NikF2iCjTD72vU0g](https://paper.dropbox.com/doc/SpankPay-BOOTY-Drop-2-Hub-Client-APIs--AP3nxlvN~p_IZ_a8UR2C~qshAg-Xon50NikF2iCjTD72vU0g)

Contract: [https://github.com/ConnextProject/contracts/blob/master/contracts/ChannelManager.sol](https://github.com/ConnextProject/contracts/blob/master/contracts/ChannelManager.sol)

Flowcharts: [https://github.com/ConnextProject/contracts/tree/master/docs/diagrams](https://github.com/ConnextProject/contracts/tree/master/docs/diagrams)

# Channel Manager v1

The ChannelManager.sol contract manages bidirectional ETH/ERC20 channels between
a single payment channel hub and its users. It also allows users who have channels with the hub to open P2P unidirectional ETH/ERC20 subchannels that we call *threads* to pay each other directly, without the hub ever having custody of the transferred funds. The ChannelManager can also be used to secure ETH/ERC20 exchange.

The contract is designed to secure *offchain* updates - that is, it offers the hub and users the ability to, at any time, decide to exit their channels and withdraw all their funds. At minimum, the contract must be able to handle these unilaterally initiated exits.

# Overview

## Single Token Contract Per Channel Manager

To increase security, ChannelManager.sol can only support one ERC20 token. The address of the ERC20 token is set at contract construction time and cannot be modified later. This prevents malicious ERC20 smart contracts from exploiting the Channel Manager, and drastically simplifies its implementation.

## Stateful Channels

Instead of storing channels onchain by a random ID generated at the time the channel is opened, we have moved to storing channels onchain by the user's address. This means that users can only ever have **one** channel open on this contract. This has several implications:

1. Users no longer need to **open** channels, because channels are assumed to be open for all users as soon as the contract is deployed.
2. When users want to fully withdraw their balances from the contract, the `txCount` (nonce) of the channel will be saved onchain, even as the balances are zeroed out.
3. When users want to deposit additional funds into the contract *after* they have fully withdrawn, they will need to increment the `txCount` that was previously saved onchain, picking up from where they left off.

## Authorized Updates

There are many cases, however, when the hub or a user may want to deposit into, withdraw from, checkpoint, or close a channel where the counterparty provides their consent in advance. We realized that all of these cases could be combined into two contract functions:

1. `hubAuthorizedUpdate`
2. `userAuthorizedUpdate`

These functions can be used by either party to update the onchain channel state to reflect the latest mutually signed (authorized) state update, as well as execute any authorized deposits or withdrawals.

## Pending Deposits and Withdrawals

Updates to channel balances (ie, deposits and withdrawals) are performed via a **two-phase commit**.

In the first phase, parties sign an offchain update adding the amount to be deposited and/or withdrawn to the `pending` state fields:

    pendingWeiUpdates: [hubDeposit, hubWithdrawal, userDeposit, userWithdrawal]
    pendingTokenUpdates: [hubDeposit, hubWithdrawal, userDeposit, userWithdrawal]

The "pending" portion of the `txCount` (which is now a `uint256[2]`, explained below) is incremented and, for a withdrawal, the parties would remove the net (withdraw - deposit) pending value to be taken out of the channel. This ensures that the offchain balance *always* tracks the amount of value in the channel that could be transacted without risking a double spend. For more information, see: [https://github.com/ConnextProject/contracts/blob/master/docs/aggregateUpdates.md](https://github.com/ConnextProject/contracts/blob/master/docs/aggregateUpdates.md)

In the second phase, this signed state is broadcast onchain (via the `hubAuthorizedUpdate` or `userAuthorizedUpdate` smart contract methods), and the pending transactions are executed (ie, ETH and tokens are transferred). Note that this allows a single onchain transaction to perform deposits, withdrawals, and transfers, facilitating single-transaction ETH/ERC20 swaps.

Finally, when one party or the other notices the onchain transaction, they propose an offchain update removing the `pending` fields, and transferring any pending deposits into the useable balances:

1. `weiBalances`
2. `tokenBalances`

The counterparty will validate this state update by checking that a `DidUpdateChannel` event has been emitted where the following fields match the most recent state:

    pendingWeiUpdates
    pendingTokenUpdates
    txCount[1] // the pending tx count

(in practice, the Hub will include the transaction hash of the transaction which contains this event to make it easier for the client to find)

**TODO:** define what happens if the client rejects. Proposal: return an error along with an invalidating state N + 1.

(in practice, for the first version, only the hub will be watching the blockchain for transactions)

Note: `pending` values cannot be added or updated if the current state already has `pending` values. For example, if the current state includes a pending withdrawal, subsequent states may not modify the pending withdrawal (except to remove it), and they also may not add a pending deposit. They may, however, modify the `balances` (this allows offchain transactions to continue as normal while a deposit or withdrawal is pending).

For example:

State 1: initial state:

    tokenBalances: [10, 20] // [hub, user]
    txCount: [1, 1] // [global, pending]

State 2: after adding a pending balance:

    tokenBalances: [10, 20]
    //[hubDeposit, hubWithdrawal, userDeposit, userWithdrawal]
    pendingWeiUpdates: [11, 0, 22, 0]
    txCount: [2, 2]

State 2.5: an offchain transaction takes place (this is an example):

    tokenBalances: [5, 25]
    pendingWeiUpdates: [11, 0, 22, 0]
    txCount: [3, 2]

State 3: after removing the pending balances:

    tokenBalances: [16, 47]
    txCount: [4, 2]

For more, see:

- The deposit and withdrawal examples, below.
- The implementation of `hubAuthorizedUpdate` and `userAuthorizedUpdate` for an example of how pending states are executed.

## Transaction Counts

Nonces have been replaced with a `txCount` tuple. `txCount[0]` represents the global nonce, and `txCount[1]` represents the pending updates nonce. Whenever a state update is applied offchain, `txCount[0]` is incremented. Whenever a state containing a pending update is generated, `txCount[1]` is incremented. In normal channel operation, `txCount[1]` will only be incremented on deposits and withdrawals. The goal of tracking offchain and pending updates separately is to facilitate the two-phase commit described above, and allow a withdrawal from a channel without completely zeroing it out. For example, a previously-disputed channel may be re-used as long as `txCount[1]` continually increases from the point of dispute.

## Time-Sensitive Updates and Timeouts

There are two kinds of timeouts to be considered: onchain timeouts and offchain timeouts.

**Onchain Timeouts**

Any state update including a `timeout` must be submitted to chain before the timeout expires, otherwise they are considered invalid and will be rejected.

Onchain timeouts are used for two pending operations:

1. User deposits.

    A timeout is included with user deposits to simplify situations where the user's transaction could never succeed (ex, the deposit is for 1 ETH, but the user only has 0.5 ETH in their wallet), or situations where a transaction gets stuck in the mempool.

    Consider, for example, a situation where a user deposit is submitted onchain, but it gets stuck in the mempool. It would be possible to invent a protocol wherein the user asks the hub to sign a new state removing the pending deposit. However, if the first onchain deposit eventually succeeds, the hub and user will need to reconcile this new balance, which could be especially difficult if a subsequent deposit has been submitted.

    Because a timeout is included, however, no edge cases need to be considered: either the onchain transaction is confirmed within the timeout, or it is discarded. After the timeout has expired, it can be invalidated

    Please see this [User Deposits Flowchart](https://mermaidjs.github.io/mermaid-live-editor/#/view/eyJjb2RlIjoic2VxdWVuY2VEaWFncmFtXG5cbiAgICAjIHRpdGxlIDx1PlVzZXIgRGVwb3NpdDwvdT5cblxuICAgICMgYWxpYXNlc1xuICAgIHBhcnRpY2lwYW50IENvbnRyYWN0XG4gICAgcGFydGljaXBhbnQgVXNlclxuICAgIHBhcnRpY2lwYW50IEh1YlxuXG4gICAgTm90ZSBvdmVyIFVzZXI6IERlY2lkZXMgdG8gZGVwb3NpdCA8YnI-IDEwMCB3ZWlcblxuICAgIG9wdCBSZXF1ZXN0IERlcG9zaXQgQXBwcm92YWxcbiAgICAgICAgVXNlci0-Pkh1YjogL2NoYW5uZWwvOmFkZHJlc3MvdXNlckRlcG9zaXRcblxuICAgICAgICBOb3RlIG92ZXIgVXNlcixIdWI6IDxicj4gU3RhdGU6IDxicj4geyBwZW5kaW5nRGVwb3NpdFdlaTogWzAsIDEwMF0gLy9baHViLCB1c2VyXSwgPGJyPiB3ZWlCYWxhbmNlczogWzAsIDBdLCA8YnI-IHRva2VuQmFsYW5jZXM6IFswLCAwXSA8YnI-IHR4Q291bnQ6IFsxLCAxXSwgPGJyPiB0aW1lb3V0OiAxNTY3MDAzOTEgfVxuICAgIGVuZFxuXG4gICAgTm90ZSBvdmVyIEh1YjogU2hvdWxkIGRlcG9zaXQgPGJyPiB0b2tlbnMgZm9yIGV4Y2hhbmdlP1xuXG4gICAgYWx0IERlcG9zaXRzIFRva2Vuc1xuICAgICAgICBIdWItPj5Vc2VyOiBcblxuICAgICAgICAjIHdoYXQgaGFwcGVucyB0byB0aGUgdHhDb3VudCBpZiB0aGUgaHViIGRlcG9zaXRzIGhlcmU_XG5cbiAgICAgICAgTm90ZSBvdmVyIFVzZXIsSHViOiA8YnI-IFN0YXRlOiA8YnI-IHsgcGVuZGluZ0RlcG9zaXRXZWk6IFswLCAxMDBdLCA8YnI-IHBlbmRpbmdEZXBvc2l0VG9rZW5zOiBbNjksIDBdLCA8YnI-IHdlaUJhbGFuY2VzOiBbMCwgMF0sIDxicj4gdG9rZW5CYWxhbmNlczogWzAsIDBdLCA8YnI-IHR4Q291bnQ6IFsxLCAxXSwgPGJyPiB0aW1lb3V0OiAxNTY3MDAzOTEsIDxicj5zaWdJOiAweGFjM2YgfVxuXG4gICAgZWxzZSBEb2Vzbid0IERlcG9zaXRcbiAgICAgICAgSHViLT4-VXNlcjogXG5cbiAgICAgICAgTm90ZSBvdmVyIFVzZXIsSHViOiA8YnI-IFN0YXRlOiA8YnI-IHsgcGVuZGluZ0RlcG9zaXRXZWk6IFswLCAxMDBdLCA8YnI-IHBlbmRpbmdEZXBvc2l0VG9rZW5zOiBbMCwgMF0sIDxicj4gd2VpQmFsYW5jZXM6IFswLCAwXSwgPGJyPiB0b2tlbkJhbGFuY2VzOiBbMCwgMF0gPGJyPiB0eENvdW50OiBbMSwgMV0sIDxicj4gdGltZW91dDogMTU2NzAwMzkxLCA8YnI-c2lnSTogMHhhYzNmIH1cblxuICAgIGVuZFxuXG4gICAgbG9vcCBQb2xsIGZvciBVc2VyIERlcG9zaXRcbiAgICAgICAgSHViLT4-SHViOiBWZXJpZnkgb25jaGFpbiBkZXBvc2l0XG5cbiAgICAgICAgTm90ZSBvdmVyIEh1YjogQW1vdW50cyBtYXRjaD8gPGJyPiBEZXBvc2l0IGNvbmZpcm1lZD9cbiAgICBlbmRcbiAgICBcbiAgICBOb3RlIG92ZXIgVXNlcjogVmVyaWZ5IHN0YXRlLCBjb3NpZ25cblxuICAgIGFsdCBVc2VyIHN1Ym1pdHMgc3RhdGVcbiAgICAgICAgVXNlci0-PkNvbnRyYWN0OiB1c2VyQXV0aG9yaXplZFN0YXRlVXBkYXRlXG5cbiAgICBlbHNlIFVzZXIgZG9lcyBub3Qgc3VibWl0IHN0YXRlXG4gICAgICAgIE5vdGUgb3ZlciBIdWI6IFRpbWVyIGV4cGlyZXMgPGJyPiBTdGF0ZSBpcyBpbnZhbGlkIGZyb20gPGJyPiB0aW1lb3V0IGV4cGlyeS4gTmV4dCA8YnI-IHN0YXRlIHdpbGwgaGF2ZSBzYW1lIDxicj4gdHhDb3VudC5cbiAgICBlbmRcblxuICAgIE5vdGUgb3ZlciBDb250cmFjdDogRGVwb3NpdCBjb25maXJtZWQhXG5cbiAgICBOb3RlIG92ZXIgVXNlcixIdWI6IEVpdGhlciBwYXJ0eSBjYW4gcHJvcG9zZSB0aGUgPGJyPiBmb2xsb3dpbmcgdXBkYXRlczpcblxuICAgIG9wdCBBY2tub3dsZWRnZSBkZXBvc2l0c1xuICAgICAgICBVc2VyLT4-SHViOiAvY2hhbm5lbC86YWRkcmVzcy91cGRhdGVcbiAgICAgICAgTm90ZSBvdmVyIFVzZXIsSHViOiBTdGF0ZTogPGJyPiB7IHdlaUJhbGFuY2VzOiBbMCwgMTAwXSwgPGJyPiB0b2tlbkJhbGFuY2VzOiBbNjksIDBdIDxicj4gdHhDb3VudDogWzIsIDFdLCA8YnI-IHRpbWVvdXQ6IDAsIDxicj5zaWdBOiAweGFjM2YgfVxuXG4gICAgICAgIE5vdGUgb3ZlciBIdWI6IFZlcmlmeSBzdGF0ZSwgY29zaWduXG5cbiAgICAgICAgSHViLT4-VXNlcjogUmV0dXJuIGRvdWJsZSBzaWduZWQgc3RhdGVcbiAgICAgICAgTm90ZSBvdmVyIFVzZXIsSHViOiA8YnI-IFN0YXRlOiA8YnI-IHsgd2VpQmFsYW5jZXM6IFswLCAxMDBdLCA8YnI-IHRva2VuQmFsYW5jZXM6IFs2OSwgMF0gPGJyPiB0eENvdW50OiBbMiwgMV0sIDxicj4gdGltZW91dDogMCwgPGJyPiBzaWdBOiAweGFjM2YsIDxicj5zaWdJOiAweGFjM2YgfVxuICAgIGVuZFxuXG4gICAgIyBOT1RFOiBJbiBwcmFjdGljZSwgYm90aCB1cGRhdGVzIGFyZSBzZW50XG4gICAgXG4gICAgb3B0IFByb3Bvc2UgQk9PVFkgZXhjaGFuZ2VcbiAgICAgICAgVXNlci0-Pkh1YjogUmVxdWVzdCBleGNoYW5nZSBhbW91bnRcbiAgICAgICAgIyBib2R5IHRvIGdvIGhlcmU_XG5cbiAgICAgICAgSHViLT4-VXNlcjogUHJvcG9zZSB1bnNpZ25lZCBzdGF0ZVxuICAgICAgICBOb3RlIG92ZXIgVXNlcixIdWI6IDxicj4gU3RhdGU6IDxicj4geyB3ZWlCYWxhbmNlczogWzY5LCAzMV0sIDxicj4gdG9rZW5CYWxhbmNlczogWzAsIDY5XSA8YnI-IHR4Q291bnQ6IFsyLCAxXSwgPGJyPiB0aW1lb3V0OiAwIH1cblxuICAgICAgICBOb3RlIG92ZXIgVXNlcjogVmVyaWZ5IGV4Y2hhbmdlIDxicj4gcmF0ZSwgc2lnblxuXG4gICAgICAgIFVzZXItPj5IdWI6IC9jaGFubmVsLzphZGRyZXNzL3Byb3Bvc2VleGNoYW5nZVxuICAgICAgICBOb3RlIG92ZXIgVXNlcixIdWI6IDxicj4gU3RhdGU6IDxicj4geyB3ZWlCYWxhbmNlczogWzY5LCAzMV0sIDxicj4gdG9rZW5CYWxhbmNlczogWzAsIDY5XSA8YnI-IHR4Q291bnQ6IFsyLCAxXSwgPGJyPiB0aW1lb3V0OiAwLCA8YnI-IHNpZ0E6IDB4YzNhIH1cblxuICAgICAgICBIdWItPj5IdWI6IFZlcmlmaWNhdGlvblxuICAgICAgICBOb3RlIG92ZXIgSHViOiBWZXJpZnk6IDxicj4gLSBFeGNoYW5nZSByYXRlIDxicj4gLSBMaXF1aWRpdHkgPGJyPiAtIEFtb3VudCA8YnI-IC0gU2lnXG5cbiAgICAgICAgSHViLT4-VXNlcjogQ29zaWduXG4gICAgICAgIE5vdGUgb3ZlciBVc2VyLEh1YjogPGJyPiBTdGF0ZTogPGJyPiB7IHdlaUJhbGFuY2VzOiBbNjksIDMxXSwgPGJyPiB0b2tlbkJhbGFuY2VzOiBbMCwgNjldIDxicj4gdHhDb3VudDogWzIsIDFdLCA8YnI-IHRpbWVvdXQ6IDAsIDxicj4gc2lnQTogMHhjM2EsIDxicj4gc2lnSTogMHhkM2YgfVxuXG4gICAgZW5kXG5cbiAgICBOb3RlIG92ZXIgSHViLFVzZXI6IEluIHByYWN0aWNlLCBib3RoIHVwZGF0ZXMgYXJlIHNlbnQgPGJyPiB0byB0aGUgaHViIHNpbXVsdGFuZW91c2x5LCBib3RoIDxicj4gY29uZmlybWluZyBkZXBvc2l0IGF0IG4gYW5kIDxicj4gZXhjaGFuZ2luZyBmb3IgQk9PVFkgYXQgbisxXG4iLCJtZXJtYWlkIjp7InRoZW1lIjoiZGVmYXVsdCJ9fQ) for more information.

2. Onchain exchanges.

    A timeout is included any time a Token <> ETH exchange is made to protect both parties against market fluctuations. If an onchain transaction includes an exchange (for example, a user withdrawal), a `timeout` will be included.

**Note:** when there's a state with a `timeout`, no offchain updates can be made until it has been resolved (because those updates could be rendered invalid if the state with the `timeout` does not get successfully submitted to chain).

**Offchain Timeouts**

Because Token <> ETH exchanges can happen offchain, they also require a timeout to protect against market fluctuations. Unfortunately there is no straightforward timeout mechanism which can protect *both* parties in offchain transactions, so we have opted protect the hub. Note, however, this is not done with an explicit timeout; see below.

Please see this [Offchain Exchange Flowchart](https://mermaidjs.github.io/mermaid-live-editor/#/view/eyJjb2RlIjoic2VxdWVuY2VEaWFncmFtXG5cbiAgICAjIHRpdGxlIDx1Pk9mZmNoYWluIEV4Y2hhbmdlPC91PlxuXG4gICAgIyBhbGlhc2VzXG4gICAgcGFydGljaXBhbnQgVXNlclxuICAgIHBhcnRpY2lwYW50IEh1YlxuICAgIHBhcnRpY2lwYW50IENvbnRyYWN0XG5cblxuICAgIE5vdGUgb3ZlciBVc2VyOiBEZWNpZGVzIHRvIGV4Y2hhbmdlIDxicj4gNjkgd2VpIGZvciA2OSBCT09UWS5cblxuXG4gICAgVXNlci0-Pkh1YjogUHJvcG9zZXMgRXhjaGFuZ2VcbiAgICBOb3RlIG92ZXIgVXNlcixIdWI6IHsgZGVzaXJlZEN1cnJlbmN5OiAnQk9PVFknLDxicj5leGNoYW5nZUFtb3VudDogNjksPGJyPnR4Q291bnQ6IDEgfVxuXG5IdWItPj5Vc2VyOiBQcm9wb3NlZCwgdW5zaWduZWQgc3RhdGUgdXBkYXRlXG5Ob3RlIG92ZXIgVXNlcixIdWI6IFN0YXRlOiA8YnI-IHsgd2VpQmFsYW5jZXM6IFs2OSwgMF0gLy9baHViLCB1c2VyXSwgPGJyPiB0b2tlbkJhbGFuY2VzOiBbMCwgNjldLCA8YnI-IHR4Q291bnQ6IFsyLCAxXTxicj48YnI-ICB9IFxuXG5Vc2VyLT4-SHViOiBWZXJpZmllZCwgc2lnbmVkIHN0YXRlIHVwZGF0ZVxuTm90ZSBvdmVyIFVzZXIsSHViOiBTdGF0ZTogPGJyPiB7IHdlaUJhbGFuY2VzOiBbNjksIDBdIC8vW2h1YiwgdXNlcl0sIDxicj4gdG9rZW5CYWxhbmNlczogWzAsIDY5XSwgPGJyPiB0eENvdW50OiBbMiwgMV0sIDxicj48YnI-PGJyPnNpZ0E6IDB4YWMzZn0gPGJyPnRpbWVvdXQ6IDE1NjcwMDM5MSAob2ZmY2hhaW4pXG4gICAgVXNlci0tPlVzZXI6IFN0YXJ0IE9mZmNoYWluIFRpbWVyXG5cbiAgICBhbHQgSHViIHJlc3BvbmRzIGluIHRpbWVcblxuICAgICAgICBIdWItPj5IdWI6IFZlcmlmeSBFeGNoYW5nZVxuXG4gICAgICAgIGFsdCBFeGNoYW5nZSB2ZXJpZmllZFxuICAgICAgICAgICAgXG4gICAgICAgICAgICBIdWItPj5Vc2VyOiBDb3NpZ24gZXhjaGFuZ2Ugc3RhdGVcbiAgICAgICAgICAgIE5vdGUgb3ZlciBVc2VyLEh1YjogU3RhdGU6IDxicj4geyB3ZWlCYWxhbmNlczogWzY5LCAwXSAvL1todWIsIHVzZXJdLCA8YnI-IHRva2VuQmFsYW5jZXM6IFswLCA2OV0sIDxicj4gdHhDb3VudDogWzIsIDFdLCA8YnI-c2lnQTogMHhhYzNmLCA8YnI-c2lnSTogMHhhYzNmIH0gPGJyPiB0aW1lb3V0OiAxNTY3MDAzOTEgKG9mZmNoYWluKVxuICAgICAgXG4gICAgICAgICAgICBVc2VyLS0-VXNlcjogUmVtb3ZlIE9mZmNoYWluIFRpbWVyXG5cbiAgICAgICAgZWxzZSBFeGNoYW5nZSByZWplY3RlZFxuICAgICAgICAgICAgXG4gICAgICAgICAgICBIdWItPj5Vc2VyOiBQcmV2aW91cyBzdGF0ZSBhdCBoaWdoZXIgbm9uY2VcbiAgICAgICAgICAgIE5vdGUgb3ZlciBVc2VyLEh1YjogUHJldmlvdXMgc3RhdGUgd2l0aCBoaWdoZXIgbm9uY2UgaXMgPGJyPiBzaWduZWQgYW5kIHJldHVybmVkIHRvIHVzZXIuIDxicj4gU3RhdGU6IDxicj4geyB3ZWlCYWxhbmNlczogWzAsIDY5XSAvL1todWIsIHVzZXJdLCA8YnI-IHRva2VuQmFsYW5jZXM6IFs2OSwgMF0sIDxicj4gdHhDb3VudDogWzMsIDFdLCA8YnI-PGJyPnNpZ0k6IDB4YWMzZiB9XG5cbiAgICAgICAgICAgIFVzZXItLT5Vc2VyOiBSZW1vdmUgT2ZmY2hhaW4gVGltZXJcblxuICAgICAgICAgICAgVXNlci0-Pkh1YjogVmVyaWZ5IHN0YXRlLCBjb3NpZ25cbiAgICAgICAgICAgIE5vdGUgb3ZlciBVc2VyLEh1YjogU3RhdGU6IDxicj4geyB3ZWlCYWxhbmNlczogWzAsIDY5XSAvL1todWIsIHVzZXJdLCA8YnI-IHRva2VuQmFsYW5jZXM6IFs2OSwgMF0sIDxicj4gdHhDb3VudDogWzMsIDFdLCA8YnI-c2lnSTogMHhhYzNmLCA8YnI-c2lnQTogMHhhYzNmIH1cblxuICAgICAgICAgICAgVXNlci0tPlVzZXI6IFByb3Bvc2UgbmV3IGV4Y2hhbmdlIHVwZGF0ZVxuXG4gICAgICAgIGVuZFxuXG4gICAgZWxzZSBIdWIgZG9lc250IHJlc3BvbmQgaW4gdGltZVxuICAgIFxuICAgICAgICBhbHQgRGlzcHV0ZSB3aXRoIG9uIGNoYWluIHN0YXRlXG4gICAgICAgICAgICBVc2VyLT4-Q29udHJhY3Q6IHN0YXJ0RXhpdCgpXG4gICAgICAgIGVsc2UgRGlzcHV0ZSB3aXRoIG9mZiBjaGFpbiBzdGF0ZVxuICAgICAgICAgICAgVXNlci0-PkNvbnRyYWN0OiBzdGFydEV4aXRXaXRoVXBkYXRlKClcbiAgICAgICAgZW5kXG5cbiAgICAgICAgTm90ZSBvdmVyIFVzZXIsQ29udHJhY3Q6IENvbnRpbnVlIHdpdGggdGhlIHRocmVhZCBkaXNwdXRlcyBvbmNlIHRoZSBjaGFubmVsIGRpc3B1dGUgaXM8YnI-IGNvbXBsZXRlZCwgaWYgdGhlcmUgYXJlIGFueSBvcGVuIHRocmVhZHMuXG4gICAgZW5kIiwibWVybWFpZCI6eyJ0aGVtZSI6ImRlZmF1bHQifX0) for more information.

When performing offchain Token <> ETH swaps:

1. The user calls an API endpoint on the hub to request an exchange with a certain amount of ETH/Token.
2. The hub returns an unsigned state update at `txCount = N` to the user, with a reasonable exchange rate.
3. The user verifies the exchange rate, signs the state update and returns it to the hub. The user also starts an internal timeout. Note that this timeout is not included in the state signature.
4. The hub checks that the exchange rate in the signed state update is still valid (i.e. that the current market rate is still reasonably close to the exchange rate), then countersigns the update and returns it to the user.
5. Note here that the hub has a half-signed update, which it could use to maliciously exchange with the user at a more favorable rate. To protect against this, the hub generates a state update at `txCount = N + 1` which reverts the exchange, signs it and returns it to the user *if* the original exchange update becomes invalid due to the price check in step 3.
    - By doing this, the user has the ability to negate the outcome where the hub maliciously holds on to the exchange state and signs it at a favorable rate. We expect that simply the *threat* of negation here is enough for both parties to operate cooperatively.
6. The user waits until the end of the timeout for the hub to respond with either the double signed original exchange state, or the hubs single signed exchange negation update. If the user does not receive a response by the end of the timeout, they assume that the hub is malicious and dispute the channel with their last known state before the exchange.

Note: this is still vulnerable, because the user's last known state could be "trumped" by the exchange state that the hub still holds in a dispute. The benefit of starting the exit process after a timer is that it places an upper bound time limit on the potential downside to the user (due to price swings in the hub's favor).

## Hub Reserve

The hub collateralizes channels via a 'reserve balance' that exists within the Channel Manager contract. The purpose of the reserve balance is to reduce the number of onchain transactions required to collateralize user channels. Previously, recollateralization blocked usage of a particular channel until the hub deposited funds via a smart contract call. Now, recollateralization can happen as part of any other channel balance update since the act of depositing funds is decoupled from the act of collateralization.

## Dispute State Machine

Unlike the previous smart contract, ChannelManager.sol only supports a single round of disputes for channels - that is, after a dispute is initiated then the other party has only one opportunity to present a challenge rather than each challenge resetting the challenge timer. This dramatically simplifies the dispute process. Notably, however, `msg.sender` is checked in each dispute method to ensure that only the non-disputing party can enter a challenge. This temporarily prevents the use of watchtowers. Future iterations of the contract will modify this behavior to allow watchtowers.

Note that threads still use the dispute timer→repeated challenge mechanism as per the old contracts.

## Example Transactions

**User Deposit**

Note: the flow is the same regardless of whether or not there is a balance in the channel.

1. User decides how much they want to deposit
2. User requests the hub to send a state update with the deposit amount included as a pending deposit.
    - The Hub may also chose to include ETH or tokens as part of the deposit, which could later be exchanged offchain. For example, if the user is depositing 1 ETH, the hub may chose to deposit 69 BOOTY.

    // [hubDeposit, hubWithdrawal, userDeposit, userWithdrawal]
            pendingWeiUpdates: [0, 0, 1 eth, 0]
            pendingTokenUpdates: [69 booty, 0, 0, 0]
            weiBalances: [0, 0]
            tokenBalances: [0, 0]
            txCount: [1, 1]
            timeout: currentBlockTime + 5 minutes

Note that a timeout is included in all user deposits - regardless of whether or not the hub is making a deposit - to ensure that the channel isn't left in limbo if the onchain transaction can't succeed. For more details, see the "Time-Sensitive Operations and Timeouts" heading.

1. The user counter-signs the state update from the hub, then publishes to chain, along with the requisite payment (ie, the value of `pendingWeiUpdates[3]`.
2. Once the onchain transaction has been confirmed, either party may propose a state update moving the pending deposits into balances.

Note: offchain updates may take place between the time the update is published to chain and the time onchain confirmation is received.

For example, if the state published to the chain was:

    // State published to chain:
        pendingWeiUpdates: [0, 0, 1 eth, 0]
        pendingTokenUpdates: [69 booty, 0, 0, 0]
        weiBalances: [0, 0]
        tokenBalances: [0, 0]
        txCount: [1, 1]
        timeout: currentBlockTime + 5 minutes

Then, after the transaction has been confirmed, an offchain update would be proposed that moves the deposits to the balances:

    // Offchain update
        weiBalances: [0, 1 eth]
        tokenBalances: [69 booty, 0]
        txCount: [2, 1]

1. The counterparty will validate that the transaction has been confirmed onchain, then countersign and return the update.

In practice, only the hub will be watching for the onchain transaction (step 4), although at some point this functionality may also be built into the wallet.

Please see this [User Deposits Flowchart](https://mermaidjs.github.io/mermaid-live-editor/#/view/eyJjb2RlIjoic2VxdWVuY2VEaWFncmFtXG5cbiAgICAjIHRpdGxlIDx1PlVzZXIgRGVwb3NpdDwvdT5cblxuICAgICMgYWxpYXNlc1xuICAgIHBhcnRpY2lwYW50IENvbnRyYWN0XG4gICAgcGFydGljaXBhbnQgVXNlclxuICAgIHBhcnRpY2lwYW50IEh1YlxuXG4gICAgTm90ZSBvdmVyIFVzZXI6IERlY2lkZXMgdG8gZGVwb3NpdCA8YnI-IDEwMCB3ZWlcblxuICAgIG9wdCBSZXF1ZXN0IERlcG9zaXQgQXBwcm92YWxcbiAgICAgICAgVXNlci0-Pkh1YjogL2NoYW5uZWwvOmFkZHJlc3MvdXNlckRlcG9zaXRcblxuICAgICAgICBOb3RlIG92ZXIgVXNlcixIdWI6IDxicj4gU3RhdGU6IDxicj4geyBwZW5kaW5nRGVwb3NpdFdlaTogWzAsIDEwMF0gLy9baHViLCB1c2VyXSwgPGJyPiB3ZWlCYWxhbmNlczogWzAsIDBdLCA8YnI-IHRva2VuQmFsYW5jZXM6IFswLCAwXSA8YnI-IHR4Q291bnQ6IFsxLCAxXSwgPGJyPiB0aW1lb3V0OiAxNTY3MDAzOTEgfVxuICAgIGVuZFxuXG4gICAgTm90ZSBvdmVyIEh1YjogU2hvdWxkIGRlcG9zaXQgPGJyPiB0b2tlbnMgZm9yIGV4Y2hhbmdlP1xuXG4gICAgYWx0IERlcG9zaXRzIFRva2Vuc1xuICAgICAgICBIdWItPj5Vc2VyOiBcblxuICAgICAgICAjIHdoYXQgaGFwcGVucyB0byB0aGUgdHhDb3VudCBpZiB0aGUgaHViIGRlcG9zaXRzIGhlcmU_XG5cbiAgICAgICAgTm90ZSBvdmVyIFVzZXIsSHViOiA8YnI-IFN0YXRlOiA8YnI-IHsgcGVuZGluZ0RlcG9zaXRXZWk6IFswLCAxMDBdLCA8YnI-IHBlbmRpbmdEZXBvc2l0VG9rZW5zOiBbNjksIDBdLCA8YnI-IHdlaUJhbGFuY2VzOiBbMCwgMF0sIDxicj4gdG9rZW5CYWxhbmNlczogWzAsIDBdLCA8YnI-IHR4Q291bnQ6IFsxLCAxXSwgPGJyPiB0aW1lb3V0OiAxNTY3MDAzOTEsIDxicj5zaWdJOiAweGFjM2YgfVxuXG4gICAgZWxzZSBEb2Vzbid0IERlcG9zaXRcbiAgICAgICAgSHViLT4-VXNlcjogXG5cbiAgICAgICAgTm90ZSBvdmVyIFVzZXIsSHViOiA8YnI-IFN0YXRlOiA8YnI-IHsgcGVuZGluZ0RlcG9zaXRXZWk6IFswLCAxMDBdLCA8YnI-IHBlbmRpbmdEZXBvc2l0VG9rZW5zOiBbMCwgMF0sIDxicj4gd2VpQmFsYW5jZXM6IFswLCAwXSwgPGJyPiB0b2tlbkJhbGFuY2VzOiBbMCwgMF0gPGJyPiB0eENvdW50OiBbMSwgMV0sIDxicj4gdGltZW91dDogMTU2NzAwMzkxLCA8YnI-c2lnSTogMHhhYzNmIH1cblxuICAgIGVuZFxuXG4gICAgbG9vcCBQb2xsIGZvciBVc2VyIERlcG9zaXRcbiAgICAgICAgSHViLT4-SHViOiBWZXJpZnkgb25jaGFpbiBkZXBvc2l0XG5cbiAgICAgICAgTm90ZSBvdmVyIEh1YjogQW1vdW50cyBtYXRjaD8gPGJyPiBEZXBvc2l0IGNvbmZpcm1lZD9cbiAgICBlbmRcbiAgICBcbiAgICBOb3RlIG92ZXIgVXNlcjogVmVyaWZ5IHN0YXRlLCBjb3NpZ25cblxuICAgIGFsdCBVc2VyIHN1Ym1pdHMgc3RhdGVcbiAgICAgICAgVXNlci0-PkNvbnRyYWN0OiB1c2VyQXV0aG9yaXplZFN0YXRlVXBkYXRlXG5cbiAgICBlbHNlIFVzZXIgZG9lcyBub3Qgc3VibWl0IHN0YXRlXG4gICAgICAgIE5vdGUgb3ZlciBIdWI6IFRpbWVyIGV4cGlyZXMgPGJyPiBTdGF0ZSBpcyBpbnZhbGlkIGZyb20gPGJyPiB0aW1lb3V0IGV4cGlyeS4gTmV4dCA8YnI-IHN0YXRlIHdpbGwgaGF2ZSBzYW1lIDxicj4gdHhDb3VudC5cbiAgICBlbmRcblxuICAgIE5vdGUgb3ZlciBDb250cmFjdDogRGVwb3NpdCBjb25maXJtZWQhXG5cbiAgICBOb3RlIG92ZXIgVXNlcixIdWI6IEVpdGhlciBwYXJ0eSBjYW4gcHJvcG9zZSB0aGUgPGJyPiBmb2xsb3dpbmcgdXBkYXRlczpcblxuICAgIG9wdCBBY2tub3dsZWRnZSBkZXBvc2l0c1xuICAgICAgICBVc2VyLT4-SHViOiAvY2hhbm5lbC86YWRkcmVzcy91cGRhdGVcbiAgICAgICAgTm90ZSBvdmVyIFVzZXIsSHViOiBTdGF0ZTogPGJyPiB7IHdlaUJhbGFuY2VzOiBbMCwgMTAwXSwgPGJyPiB0b2tlbkJhbGFuY2VzOiBbNjksIDBdIDxicj4gdHhDb3VudDogWzIsIDFdLCA8YnI-IHRpbWVvdXQ6IDAsIDxicj5zaWdBOiAweGFjM2YgfVxuXG4gICAgICAgIE5vdGUgb3ZlciBIdWI6IFZlcmlmeSBzdGF0ZSwgY29zaWduXG5cbiAgICAgICAgSHViLT4-VXNlcjogUmV0dXJuIGRvdWJsZSBzaWduZWQgc3RhdGVcbiAgICAgICAgTm90ZSBvdmVyIFVzZXIsSHViOiA8YnI-IFN0YXRlOiA8YnI-IHsgd2VpQmFsYW5jZXM6IFswLCAxMDBdLCA8YnI-IHRva2VuQmFsYW5jZXM6IFs2OSwgMF0gPGJyPiB0eENvdW50OiBbMiwgMV0sIDxicj4gdGltZW91dDogMCwgPGJyPiBzaWdBOiAweGFjM2YsIDxicj5zaWdJOiAweGFjM2YgfVxuICAgIGVuZFxuXG4gICAgIyBOT1RFOiBJbiBwcmFjdGljZSwgYm90aCB1cGRhdGVzIGFyZSBzZW50XG4gICAgXG4gICAgb3B0IFByb3Bvc2UgQk9PVFkgZXhjaGFuZ2VcbiAgICAgICAgVXNlci0-Pkh1YjogUmVxdWVzdCBleGNoYW5nZSBhbW91bnRcbiAgICAgICAgIyBib2R5IHRvIGdvIGhlcmU_XG5cbiAgICAgICAgSHViLT4-VXNlcjogUHJvcG9zZSB1bnNpZ25lZCBzdGF0ZVxuICAgICAgICBOb3RlIG92ZXIgVXNlcixIdWI6IDxicj4gU3RhdGU6IDxicj4geyB3ZWlCYWxhbmNlczogWzY5LCAzMV0sIDxicj4gdG9rZW5CYWxhbmNlczogWzAsIDY5XSA8YnI-IHR4Q291bnQ6IFsyLCAxXSwgPGJyPiB0aW1lb3V0OiAwIH1cblxuICAgICAgICBOb3RlIG92ZXIgVXNlcjogVmVyaWZ5IGV4Y2hhbmdlIDxicj4gcmF0ZSwgc2lnblxuXG4gICAgICAgIFVzZXItPj5IdWI6IC9jaGFubmVsLzphZGRyZXNzL3Byb3Bvc2VleGNoYW5nZVxuICAgICAgICBOb3RlIG92ZXIgVXNlcixIdWI6IDxicj4gU3RhdGU6IDxicj4geyB3ZWlCYWxhbmNlczogWzY5LCAzMV0sIDxicj4gdG9rZW5CYWxhbmNlczogWzAsIDY5XSA8YnI-IHR4Q291bnQ6IFsyLCAxXSwgPGJyPiB0aW1lb3V0OiAwLCA8YnI-IHNpZ0E6IDB4YzNhIH1cblxuICAgICAgICBIdWItPj5IdWI6IFZlcmlmaWNhdGlvblxuICAgICAgICBOb3RlIG92ZXIgSHViOiBWZXJpZnk6IDxicj4gLSBFeGNoYW5nZSByYXRlIDxicj4gLSBMaXF1aWRpdHkgPGJyPiAtIEFtb3VudCA8YnI-IC0gU2lnXG5cbiAgICAgICAgSHViLT4-VXNlcjogQ29zaWduXG4gICAgICAgIE5vdGUgb3ZlciBVc2VyLEh1YjogPGJyPiBTdGF0ZTogPGJyPiB7IHdlaUJhbGFuY2VzOiBbNjksIDMxXSwgPGJyPiB0b2tlbkJhbGFuY2VzOiBbMCwgNjldIDxicj4gdHhDb3VudDogWzIsIDFdLCA8YnI-IHRpbWVvdXQ6IDAsIDxicj4gc2lnQTogMHhjM2EsIDxicj4gc2lnSTogMHhkM2YgfVxuXG4gICAgZW5kXG5cbiAgICBOb3RlIG92ZXIgSHViLFVzZXI6IEluIHByYWN0aWNlLCBib3RoIHVwZGF0ZXMgYXJlIHNlbnQgPGJyPiB0byB0aGUgaHViIHNpbXVsdGFuZW91c2x5LCBib3RoIDxicj4gY29uZmlybWluZyBkZXBvc2l0IGF0IG4gYW5kIDxicj4gZXhjaGFuZ2luZyBmb3IgQk9PVFkgYXQgbisxXG4iLCJtZXJtYWlkIjp7InRoZW1lIjoiZGVmYXVsdCJ9fQ) for more information.

**Hub Deposit**

The Hub would deposit into a channel when either a user or performer channel needs to perform an in-channel swap, or when a performer channel is undercollateralized. Note that the Hub operator does not need to transfer value to the contract, as the contract would be "preloaded" with collateral (see 3.5 above). For either case, the hub deposit flow would be the following:

1. User or performer wallet initiates a request that the hub deposit. For a swap, this can be a conscious choice on the wallet that is bundled with the in-channel swap UX. For an undercollateralized performer channel, the deposit request should automatically be triggered by a low channel balance on the Hub side.
    - For example, if the performer channel contains 200 BOOTY total, but only 50 BOOTY is still held by the hub (the rest has been used), the performer may need another 100 BOOTY to ensure that payments from viewers remain uninterrupted. The hub would generate a state with the following:

            // [hubDeposit, hubWithdrawal, userDeposit, userWithdrawal]
              pendingWeiUpdates: [0, 0, 0, 0]
              pendingTokenUpdates: [100 booty, 0, 0, 0]
              weiBalances: [0, 0]
              tokenBalances: [50, 150]
              txCount: [currentOffchainCount, onChainCount++]
              //note: timeout not needed for hub functions

        - Note: For the purpose of simplicity, other fields such as `threadCount` are not shown but must be included as a part of this state.
2. User or performer wallet receives the state, verifies/signs it and returns it to the hub.
    - Reconstructing the payload from the performers knowledge of state and recovering signer on the signature yields the hub's key
3. The Hub receives the state and verifies the following:
    - Reconstructing the payload from the same data that the hub provided to performer yields the performer's key
4. If the state is valid, the Hub submits it to `hubAuthorizedUpdate` onchain and waits for the transaction to complete.
5. Upon completion, the Hub signs a new state update acknowledging the deposit (i.e. moving the deposit from `pendingTokenUpdates` into `tokenBalances` as per section 4.1 above and sends it to the counterparty.
6. The user or performer validates that the onchain transaction was completed, countersigns, and updates local storage to base further state updates off this state.

For more information, see the [Hub Deposit Flowchart](https://mermaidjs.github.io/mermaid-live-editor/#/view/eyJjb2RlIjoic2VxdWVuY2VEaWFncmFtXG5cbiAgICAjIHRpdGxlIDx1Pkh1YiBEZXBvc2l0PC91PlxuXG4gICAgIyBhbGlhc2VzXG4gICAgcGFydGljaXBhbnQgQ29udHJhY3RcbiAgICBwYXJ0aWNpcGFudCBVc2VyXG4gICAgcGFydGljaXBhbnQgSHViXG5cbiAgICBOb3RlIG92ZXIgSHViOiBEZWNpZGVzIHRvIGRlcG9zaXQgPGJyPiAxMDAgd2VpLCA2OSBCT09UWVxuXG4gICAgSHViLT4-VXNlcjogUmVxdWVzdCBEZXBvc2l0IEFwcHJvdmFsXG5cbiAgICBOb3RlIG92ZXIgSHViLFVzZXI6IDxicj4gU3RhdGU6IDxicj4geyBwZW5kaW5nRGVwb3NpdFdlaTogWzEwMCwgMF0gLy9baHViLCB1c2VyXSwgPGJyPiBwZW5kaW5nRGVwb3NpdFRva2VuOiBbNjksIDBdLCA8YnI-IHdlaUJhbGFuY2VzOiBbMCwgMTBdLCA8YnI-IHRva2VuQmFsYW5jZXM6IFswLCA2OV0gPGJyPiB0eENvdW50OiBbNSwgMl0sIDxicj4gdGltZW91dDogMH1cblxuICAgIE5vdGUgb3ZlciBVc2VyOiBWZXJpZnkgc3RhdGUsIHNpZ25cblxuICAgIFVzZXItPj5IdWI6IC9jaGFubmVsLzphZGRyZXNzL3ZlcmlmeUh1YkRlcG9zaXRcblxuICAgIE5vdGUgb3ZlciBVc2VyLEh1YjogPGJyPiBTdGF0ZTogPGJyPiB7IHBlbmRpbmdEZXBvc2l0V2VpOiBbMTAwLCAwXSwgPGJyPiBwZW5kaW5nRGVwb3NpdFRva2VuOiBbNjksIDBdLCA8YnI-IHdlaUJhbGFuY2VzOiBbMCwgMTBdLCA8YnI-IHRva2VuQmFsYW5jZXM6IFswLCA2OV0gPGJyPiB0eENvdW50OiBbNSwgMl0sIDxicj4gdGltZW91dDogMCwgPGJyPiBzaWdBOiAweGYxYSB9XG5cbiAgICBIdWItLT5IdWI6IFZlcmlmeSBhcHByb3ZhbCwgY29zaWduXG5cbiAgICBOb3RlIG92ZXIgSHViLFVzZXI6IDxicj4gU3RhdGU6IDxicj4geyBwZW5kaW5nRGVwb3NpdFdlaTogWzEwMCwgMF0gLy9baHViLCB1c2VyXSwgPGJyPiBwZW5kaW5nRGVwb3NpdFRva2VuOiBbNjksIDBdLCA8YnI-IHdlaUJhbGFuY2VzOiBbMCwgMTBdLCA8YnI-IHRva2VuQmFsYW5jZXM6IFswLCA2OV0gPGJyPiB0eENvdW50OiBbNSwgMl0sIDxicj4gdGltZW91dDogMCwgPGJyPiBzaWdBOiAweGYxYSwgPGJyPiBzaWdJOiAweGNlMiB9XG5cbiAgICBIdWItPj5Db250cmFjdDogaHViQXV0aG9yaXplZFN0YXRlVXBkYXRlXG5cbiAgICBOb3RlIG92ZXIgQ29udHJhY3Q6IFVwZGF0ZSBDb25maXJtZWQhXG5cbiAgICBIdWItPj5Vc2VyOiBSZXF1ZXN0IGRlcG9zaXQgYWNrbm93bGVkZ21lbnRcbiAgICBOb3RlIG92ZXIgVXNlcixIdWI6IDxicj4gU3RhdGU6IDxicj4geyB3ZWlCYWxhbmNlczogWzEwMCwgMTBdLCA8YnI-IHRva2VuQmFsYW5jZXM6IFs2OSwgNjldIDxicj4gdHhDb3VudDogWzYsIDJdLCA8YnI-IHRpbWVvdXQ6IDAsIDxicj4gc2lnSTogMHhjZTIgfVxuXG4gICAgTm90ZSBvdmVyIFVzZXI6IFZlcmlmeSBzdGF0ZSwgY29zaWduXG5cbiAgICBVc2VyLT4-SHViOiBDb25maXJtIGRlcG9zaXRcbiAgICBOb3RlIG92ZXIgVXNlcixIdWI6IDxicj4gU3RhdGU6IDxicj4geyB3ZWlCYWxhbmNlczogWzEwMCwgMTBdLCA8YnI-IHRva2VuQmFsYW5jZXM6IFs2OSwgNjldIDxicj4gdHhDb3VudDogWzYsIDJdLCA8YnI-IHRpbWVvdXQ6IDAsIDxicj4gc2lnSTogMHhjZTIsIDxicj4gc2lnQTogMHhmMWEgIH0iLCJtZXJtYWlkIjp7InRoZW1lIjoiZGVmYXVsdCJ9fQ) and the [Hub Collateralize Flowchart](https://mermaidjs.github.io/mermaid-live-editor/#/view/eyJjb2RlIjoic2VxdWVuY2VEaWFncmFtXG5cbiAgICAjIHRpdGxlIFN0cmVhbSBTaG93XG5cbiAgICBwYXJ0aWNpcGFudCBDb250cmFjdFxuICAgIHBhcnRpY2lwYW50IFZpZXdlclxuICAgIHBhcnRpY2lwYW50IEh1YlxuICAgIHBhcnRpY2lwYW50IFBlcmZvcm1lclxuXG4gICAgUGVyZm9ybWVyLT4-SHViOiBjaGFubmVscy86YWRkcmVzcy9zdGFydHNob3dcblxuICAgIG9wdCBDb2xsYXRlcmFsaXplIGNoYW5uZWwgb24gU3RhcnRcbiAgICAgICAgSHViLT4-UGVyZm9ybWVyOiBQcm9wb3NlIGRlcG9zaXRcbiAgICAgICAgTm90ZSBvdmVyIEh1YixQZXJmb3JtZXI6IHsgLi4uc3RhdGUgdy9wZW5kaW5nRGVwb3NpdHMuLi4gfVxuXG4gICAgICAgIFBlcmZvcm1lci0-Pkh1YjogVmVyaWZ5IGFuZCBzaWduXG4gICAgICAgIE5vdGUgb3ZlciBIdWIsUGVyZm9ybWVyOiB7IC4uLnN0YXRlIHcvcGVuZGluZ0RlcG9zaXRzLi4uLCA8YnI-IHNpZ0EgfVxuXG4gICAgICAgIEh1Yi0-Pkh1YjogVmVyaWZ5LCBjb3NpZ25cbiAgICAgICAgTm90ZSBvdmVyIEh1YjogeyAuLi5zdGF0ZSB3L3BlbmRpbmdEZXBvc2l0cy4uLiwgPGJyPiBzaWdBLCA8YnI-IHNpZ0kgfVxuICAgICAgICBcblxuICAgICAgICBIdWItPj5Db250cmFjdDogaHViQXV0aG9yaXplZFN0YXRlVXBkYXRlXG4gICAgICAgIE5vdGUgb3ZlciBDb250cmFjdDogQ29uZmlybWVkIVxuXG4gICAgICAgIEh1Yi0-PlBlcmZvcm1lcjogQ29uZmlybSBEZXBvc2l0XG4gICAgICAgIE5vdGUgb3ZlciBIdWIsUGVyZm9ybWVyOiB7IC4uLnN0YXRlLi4uLCA8YnI-IHNpZ0kgfVxuXG4gICAgICAgIFBlcmZvcm1lci0-Pkh1YjogQ29uZmlybSBEZXBvc2l0XG4gICAgICAgIE5vdGUgb3ZlciBIdWIsUGVyZm9ybWVyOiB7IC4uLnN0YXRlLi4uLCA8YnI-IHNpZ0ksIDxicj4gc2lnQSB9XG5cbiAgICBlbmRcblxuICAgIGxvb3AgTW9uaXRvciBDb2xsYXRlcmFsXG4gICAgICAgIEh1Yi0-Pkh1YjogU3RhcnQgY29sbGF0ZXJhbCBtb25pdG9yaW5nXG4gICAgZW5kXG4gICAgXG4gICAgSHViLT4-UGVyZm9ybWVyOiBHbyBmb3IgaXQhXG5cbiAgICBWaWV3ZXItPj5QZXJmb3JtZXI6IFwiSSB3YW50IHRvIGpvaW4geW91ciBzaG93XCJcbiAgICBOb3RlIG92ZXIgVmlld2VyLFBlcmZvcm1lcjogPGJyPiBJbml0aWFsIERlcG9zaXQ6IDxicj4geyB3ZWlCYWxhbmNlczogWzAsIDEwXSAvL1todWIsIHVzZXJdLCA8YnI-IHRva2VuQmFsYW5jZXM6IFsxMCwgMF0gPGJyPiB0eENvdW50OiAwLCAgPGJyPiBzaWdBOiAweGNlMiB9XG5cbiAgICBWaWV3ZXItPj5IdWI6IE9wZW4gdGhyZWFkXG4gICAgTm90ZSBvdmVyIFZpZXdlcixIdWI6IHsgLi4uY2hhbm5lbCBBIHN0YXRlLi4uLCBzaWdBOiAweGMzZiB9XG5cbiAgICBIdWItLT5IdWI6IFdhaXQgZm9yIHBlcmZvcm1lciBjb25maXJtYXRpb25cblxuICAgIFBlcmZvcm1lci0-Pkh1YjogT3BlbiB0aHJlYWRcbiAgICBOb3RlIG92ZXIgUGVyZm9ybWVyLEh1YjogeyAuLi5jaGFubmVsIEIgc3RhdGUuLi4sIHNpZ0E6IDB4YzNmIH1cblxuXG4gICAgSHViLT4-SHViOiBWZXJpZnkgdGhyZWFkIGNyZWF0aW9uIHVwZGF0ZXNcblxuICAgIEh1Yi0-PlZpZXdlcjogQ29uZmlybSB0aHJlYWQgb3BlbmVkXG4gICAgTm90ZSBvdmVyIFZpZXdlcixIdWI6IHsgLi4uY2hhbm5lbCBBIHN0YXRlLi4uLCA8YnI-c2lnQTogMHhjM2YsIDxicj5zaWdJOiAweDNmZSB9XG5cbiAgICBIdWItPj5QZXJmb3JtZXI6IENvbmZpcm0gdGhyZWFkIG9wZW5lZFxuICAgIE5vdGUgb3ZlciBQZXJmb3JtZXIsSHViOiB7IC4uLmNoYW5uZWwgQSBzdGF0ZS4uLiwgPGJyPnNpZ0E6IDB4YzNmLCA8YnI-c2lnSTogMHgzZmUgfVxuXG5cbiAgICBWaWV3ZXItPj5QZXJmb3JtZXI6IFRpcHBpbmchXG4gICAgTm90ZSBvdmVyIFZpZXdlcixQZXJmb3JtZXI6IFRpcCEgPGJyPiBQZXJmb3JtZXIgc2hvdWxkIG9ubHkgbmVlZCBsYXRlc3QgYW5kIGluaXRpYWwgdG8gZGVjb21wb3NlIG9uIGNsb3NlLlxuXG4gICAgVmlld2VyLS0-Vmlld2VyOiBBbGwgZG9uZVxuXG4gICAgVmlld2VyLT4-SHViOiBDbG9zZSB0aHJlYWRcbiAgICBOb3RlIG92ZXIgVmlld2VyLEh1YjogeyAuLi5jaGFubmVsIEEgc3RhdGUuLi4sIHNpZ0E6IDB4YzNmIH1cblxuICAgIEh1Yi0-PlZpZXdlcjogVmVyaWZ5LCBDb3NpZ25cbiAgICBOb3RlIG92ZXIgVmlld2VyLEh1YjogeyAuLi5jaGFubmVsIEEgc3RhdGUuLi4sIDxicj5zaWdBOiAweGMzZiwgPGJyPnNpZ0k6IDB4YzNmIH1cblxuICAgIEh1Yi0-PlBlcmZvcm1lcjogQ2xvc2UgdGhyZWFkXG4gICAgTm90ZSBvdmVyIFBlcmZvcm1lcixIdWI6IHsgLi4uY2hhbm5lbCBCIHN0YXRlLi4uLCBzaWdJOiAweGMzZiB9XG5cbiAgICBQZXJmb3JtZXItPj5IdWI6IFZlcmlmeSwgQ29zaWduXG4gICAgTm90ZSBvdmVyIFBlcmZvcm1lcixIdWI6IHsgLi4uY2hhbm5lbCBCIHN0YXRlLi4uLCA8YnI-c2lnQTogMHhjM2YsIDxicj5zaWdJOiAweGMzZiB9IH0iLCJtZXJtYWlkIjp7InRoZW1lIjoiZGVmYXVsdCJ9fQ).

**Offchain Token <> ETH Swap**

Please see this [Offchain Exchange Flowchart](https://mermaidjs.github.io/mermaid-live-editor/#/view/eyJjb2RlIjoic2VxdWVuY2VEaWFncmFtXG5cbiAgICAjIHRpdGxlIDx1Pk9mZmNoYWluIEV4Y2hhbmdlPC91PlxuXG4gICAgIyBhbGlhc2VzXG4gICAgcGFydGljaXBhbnQgVXNlclxuICAgIHBhcnRpY2lwYW50IEh1YlxuICAgIHBhcnRpY2lwYW50IENvbnRyYWN0XG5cblxuICAgIE5vdGUgb3ZlciBVc2VyOiBEZWNpZGVzIHRvIGV4Y2hhbmdlIDxicj4gNjkgd2VpIGZvciA2OSBCT09UWS5cblxuXG4gICAgVXNlci0-Pkh1YjogUHJvcG9zZXMgRXhjaGFuZ2VcbiAgICBOb3RlIG92ZXIgVXNlcixIdWI6IHsgZGVzaXJlZEN1cnJlbmN5OiAnQk9PVFknLDxicj5leGNoYW5nZUFtb3VudDogNjksPGJyPnR4Q291bnQ6IDEgfVxuXG5IdWItPj5Vc2VyOiBQcm9wb3NlZCwgdW5zaWduZWQgc3RhdGUgdXBkYXRlXG5Ob3RlIG92ZXIgVXNlcixIdWI6IFN0YXRlOiA8YnI-IHsgd2VpQmFsYW5jZXM6IFs2OSwgMF0gLy9baHViLCB1c2VyXSwgPGJyPiB0b2tlbkJhbGFuY2VzOiBbMCwgNjldLCA8YnI-IHR4Q291bnQ6IFsyLCAxXTxicj48YnI-ICB9IFxuXG5Vc2VyLT4-SHViOiBWZXJpZmllZCwgc2lnbmVkIHN0YXRlIHVwZGF0ZVxuTm90ZSBvdmVyIFVzZXIsSHViOiBTdGF0ZTogPGJyPiB7IHdlaUJhbGFuY2VzOiBbNjksIDBdIC8vW2h1YiwgdXNlcl0sIDxicj4gdG9rZW5CYWxhbmNlczogWzAsIDY5XSwgPGJyPiB0eENvdW50OiBbMiwgMV0sIDxicj48YnI-PGJyPnNpZ0E6IDB4YWMzZn0gPGJyPnRpbWVvdXQ6IDE1NjcwMDM5MSAob2ZmY2hhaW4pXG4gICAgVXNlci0tPlVzZXI6IFN0YXJ0IE9mZmNoYWluIFRpbWVyXG5cbiAgICBhbHQgSHViIHJlc3BvbmRzIGluIHRpbWVcblxuICAgICAgICBIdWItPj5IdWI6IFZlcmlmeSBFeGNoYW5nZVxuXG4gICAgICAgIGFsdCBFeGNoYW5nZSB2ZXJpZmllZFxuICAgICAgICAgICAgXG4gICAgICAgICAgICBIdWItPj5Vc2VyOiBDb3NpZ24gZXhjaGFuZ2Ugc3RhdGVcbiAgICAgICAgICAgIE5vdGUgb3ZlciBVc2VyLEh1YjogU3RhdGU6IDxicj4geyB3ZWlCYWxhbmNlczogWzY5LCAwXSAvL1todWIsIHVzZXJdLCA8YnI-IHRva2VuQmFsYW5jZXM6IFswLCA2OV0sIDxicj4gdHhDb3VudDogWzIsIDFdLCA8YnI-c2lnQTogMHhhYzNmLCA8YnI-c2lnSTogMHhhYzNmIH0gPGJyPiB0aW1lb3V0OiAxNTY3MDAzOTEgKG9mZmNoYWluKVxuICAgICAgXG4gICAgICAgICAgICBVc2VyLS0-VXNlcjogUmVtb3ZlIE9mZmNoYWluIFRpbWVyXG5cbiAgICAgICAgZWxzZSBFeGNoYW5nZSByZWplY3RlZFxuICAgICAgICAgICAgXG4gICAgICAgICAgICBIdWItPj5Vc2VyOiBQcmV2aW91cyBzdGF0ZSBhdCBoaWdoZXIgbm9uY2VcbiAgICAgICAgICAgIE5vdGUgb3ZlciBVc2VyLEh1YjogUHJldmlvdXMgc3RhdGUgd2l0aCBoaWdoZXIgbm9uY2UgaXMgPGJyPiBzaWduZWQgYW5kIHJldHVybmVkIHRvIHVzZXIuIDxicj4gU3RhdGU6IDxicj4geyB3ZWlCYWxhbmNlczogWzAsIDY5XSAvL1todWIsIHVzZXJdLCA8YnI-IHRva2VuQmFsYW5jZXM6IFs2OSwgMF0sIDxicj4gdHhDb3VudDogWzMsIDFdLCA8YnI-PGJyPnNpZ0k6IDB4YWMzZiB9XG5cbiAgICAgICAgICAgIFVzZXItLT5Vc2VyOiBSZW1vdmUgT2ZmY2hhaW4gVGltZXJcblxuICAgICAgICAgICAgVXNlci0-Pkh1YjogVmVyaWZ5IHN0YXRlLCBjb3NpZ25cbiAgICAgICAgICAgIE5vdGUgb3ZlciBVc2VyLEh1YjogU3RhdGU6IDxicj4geyB3ZWlCYWxhbmNlczogWzAsIDY5XSAvL1todWIsIHVzZXJdLCA8YnI-IHRva2VuQmFsYW5jZXM6IFs2OSwgMF0sIDxicj4gdHhDb3VudDogWzMsIDFdLCA8YnI-c2lnSTogMHhhYzNmLCA8YnI-c2lnQTogMHhhYzNmIH1cblxuICAgICAgICAgICAgVXNlci0tPlVzZXI6IFByb3Bvc2UgbmV3IGV4Y2hhbmdlIHVwZGF0ZVxuXG4gICAgICAgIGVuZFxuXG4gICAgZWxzZSBIdWIgZG9lc250IHJlc3BvbmQgaW4gdGltZVxuICAgIFxuICAgICAgICBhbHQgRGlzcHV0ZSB3aXRoIG9uIGNoYWluIHN0YXRlXG4gICAgICAgICAgICBVc2VyLT4-Q29udHJhY3Q6IHN0YXJ0RXhpdCgpXG4gICAgICAgIGVsc2UgRGlzcHV0ZSB3aXRoIG9mZiBjaGFpbiBzdGF0ZVxuICAgICAgICAgICAgVXNlci0-PkNvbnRyYWN0OiBzdGFydEV4aXRXaXRoVXBkYXRlKClcbiAgICAgICAgZW5kXG5cbiAgICAgICAgTm90ZSBvdmVyIFVzZXIsQ29udHJhY3Q6IENvbnRpbnVlIHdpdGggdGhlIHRocmVhZCBkaXNwdXRlcyBvbmNlIHRoZSBjaGFubmVsIGRpc3B1dGUgaXM8YnI-IGNvbXBsZXRlZCwgaWYgdGhlcmUgYXJlIGFueSBvcGVuIHRocmVhZHMuXG4gICAgZW5kIiwibWVybWFpZCI6eyJ0aGVtZSI6ImRlZmF1bHQifX0) for more information.

Note: some of this information overlaps with (but is consistent with) the **Offchain Timeouts** section.

1. The user tells the hub what they would like to exchange (ex, "69 BOOTY")
2. The hub proposes an exchange rate, and returns a state update which would perform the exchange.
For example, if the current exchange rate is 1 ETH = 69 BOOTY, and the balances before the exchange were:

        // Before exchange
         weiBalances: [1 ETH, 0]
         tokenBalances: [0, 69 BOOTY]
         txCount: [1,1]

    Then the hub's proposed update might be:

        // After exchange
         weiBalances: [0, 1 ETH]
         tokenBalances: [69 BOOTY, 0]
         txCount: [2,1]

3. The wallet checks the exchange rate, then signs the update and returns it to the hub. It also starts a timer.
4. When the hub receives the half-signed update, it double checks the exchange rate, then counter-signs and returns the fully-signed state update to the user. If the hub does not accept the half-signed update (for example, because it doesn't like the proposed exchange rate), it will respond with a different half-signed state invalidating the proposed exchange (specifically, if the proposed exchange has `txCount = [2,1]`, then the invalidating state returned by the hub will be identical to state where `txCount = [1,1]` except it will have `txCount = [3,1]`).
5. If the user does not hear back from the hub with either a countersigned exchange update or a half-signed negation update by the end of the timeout, they dispute onchain with their latest available state.

Note: if the user has an up-to-date exchange rate, steps 1, 2, and 3 could theoretically be avoided (ie, the user could use the up-to-date exchange rate to generate and sign an exchange that it knows the hub will accept). In practice, however, the hub will also need to check the user's BOOTY limit (in addition to the exchange rate), which the wallet may or may not know.

**Withdrawal with Token <> ETH Swap**

Performers can withdraw from channels using the same mechanism regardless of whether they are doing a partial or full withdraw (the latter was previously called consensusClose in our system). Users can use the same mechanism to withdraw funds as well, though we expect that it will mostly be performers using this functionality.

1. Performer begins by deciding how much they want to withdraw on the wallet
2. Wallet requests the hub to send a state update with the withdraw amount included as a pending withdraw.
    - The Hub may also chose to include ETH or tokens as part of the withdraw if the performer wanted to do a swap. For a more complex (but commonplace) example, suppose the performer has 100 BOOTY in their channel, wants to cash out in ETH but the Hub does not have that ETH already collateralized in the channel. The Hub could send over the following update:

    // [hubDeposit, hubWithdrawal, userDeposit, userWithdrawal]
            pendingWeiUpdates: [0, 0, 0.5 eth, 0.5 eth]
            pendingTokenUpdates: [0, 100 booty, 0, 0]
            weiBalances: [0, 0]
            tokenBalances: [0, 0]
            txCount: [currentOffchainCount++, onChainCount++]
            //Note: timeout not needed for hub functions

Note that the deposit and withdraw are both happening on the performer's side of the channel and that the balances remain zero. This is because setting `weiBalances[1]` to `0.5` or `tokenBalances[0]` to `100` would violate the conservation requirement on the contract. By depositing and withdrawing from the same side, the channel's pending balance is first incremented by 0.5 ETH and then reduced by 0.5 ETH for the performer, allowing them to withdraw ETH directly from the Hub's in-contract balance if they have permission. Dope.

For more info on calculating balances for deposit/withdraw states, see: [https://github.com/ConnextProject/contracts/blob/master/docs/aggregateUpdates.md](https://github.com/ConnextProject/contracts/blob/master/docs/aggregateUpdates.md)

1. Upon receiving the state update, the performer's wallet needs to validate the following:
    - The withdrawal amount matches the user's request
    - The exchange rate is correct
    - Reconstructing the payload from the user's knowledge of state and recovering signer on the signature yields the hub's public key
2. If correct, the performer signs and returns the state to the Hub.
    - Hub validates that reconstructing the payload from the previously sent state and recovering signature yields the performer's public key
3. If correct, the Hub countersigns and calls `hubAuthorizedUpdate`
4. Once the onchain transaction has been confirmed, either party may propose a state update moving the pending deposits into balances similar to 4.1 above.
5. The counterparty will validate that the transaction has been confirmed onchain, then countersign and return the update.

# Threads

Threads are used to route singlehop payments between two parties over the hub. For a full overview, [see this diagram](https://mermaidjs.github.io/mermaid-live-editor/#/edit/eyJjb2RlIjoic2VxdWVuY2VEaWFncmFtXG5cbiAgICAjIHRpdGxlIFN0cmVhbSBTaG93XG5cbiAgICBwYXJ0aWNpcGFudCBDb250cmFjdFxuICAgIHBhcnRpY2lwYW50IFZpZXdlclxuICAgIHBhcnRpY2lwYW50IEh1YlxuICAgIHBhcnRpY2lwYW50IFBlcmZvcm1lclxuXG4gICAgUGVyZm9ybWVyLT4-SHViOiBjaGFubmVscy86YWRkcmVzcy9zdGFydHNob3dcblxuICAgIG9wdCBDb2xsYXRlcmFsaXplIGNoYW5uZWwgb24gU3RhcnRcbiAgICAgICAgSHViLT4-UGVyZm9ybWVyOiBQcm9wb3NlIGRlcG9zaXRcbiAgICAgICAgTm90ZSBvdmVyIEh1YixQZXJmb3JtZXI6IHsgLi4uc3RhdGUgdy9wZW5kaW5nRGVwb3NpdHMuLi4gfVxuXG4gICAgICAgIFBlcmZvcm1lci0-Pkh1YjogVmVyaWZ5IGFuZCBzaWduXG4gICAgICAgIE5vdGUgb3ZlciBIdWIsUGVyZm9ybWVyOiB7IC4uLnN0YXRlIHcvcGVuZGluZ0RlcG9zaXRzLi4uLCA8YnI-IHNpZ0EgfVxuXG4gICAgICAgIEh1Yi0-Pkh1YjogVmVyaWZ5LCBjb3NpZ25cbiAgICAgICAgTm90ZSBvdmVyIEh1YjogeyAuLi5zdGF0ZSB3L3BlbmRpbmdEZXBvc2l0cy4uLiwgPGJyPiBzaWdBLCA8YnI-IHNpZ0kgfVxuICAgICAgICBcblxuICAgICAgICBIdWItPj5Db250cmFjdDogaHViQXV0aG9yaXplZFN0YXRlVXBkYXRlXG4gICAgICAgIE5vdGUgb3ZlciBDb250cmFjdDogQ29uZmlybWVkIVxuXG4gICAgICAgIEh1Yi0-PlBlcmZvcm1lcjogQ29uZmlybSBEZXBvc2l0XG4gICAgICAgIE5vdGUgb3ZlciBIdWIsUGVyZm9ybWVyOiB7IC4uLnN0YXRlLi4uLCA8YnI-IHNpZ0kgfVxuXG4gICAgICAgIFBlcmZvcm1lci0-Pkh1YjogQ29uZmlybSBEZXBvc2l0XG4gICAgICAgIE5vdGUgb3ZlciBIdWIsUGVyZm9ybWVyOiB7IC4uLnN0YXRlLi4uLCA8YnI-IHNpZ0ksIDxicj4gc2lnQSB9XG5cbiAgICBlbmRcblxuICAgIGxvb3AgTW9uaXRvciBDb2xsYXRlcmFsXG4gICAgICAgIEh1Yi0-Pkh1YjogU3RhcnQgY29sbGF0ZXJhbCBtb25pdG9yaW5nXG4gICAgZW5kXG4gICAgXG4gICAgSHViLT4-UGVyZm9ybWVyOiBHbyBmb3IgaXQhXG5cbiAgICBWaWV3ZXItPj5QZXJmb3JtZXI6IFwiSSB3YW50IHRvIGpvaW4geW91ciBzaG93XCJcbiAgICBOb3RlIG92ZXIgVmlld2VyLFBlcmZvcm1lcjogPGJyPiBJbml0aWFsIERlcG9zaXQ6IDxicj4geyB3ZWlCYWxhbmNlczogWzAsIDEwXSAvL1todWIsIHVzZXJdLCA8YnI-IHRva2VuQmFsYW5jZXM6IFsxMCwgMF0gPGJyPiB0eENvdW50OiAwLCAgPGJyPiBzaWdBOiAweGNlMiB9XG5cbiAgICBWaWV3ZXItPj5IdWI6IE9wZW4gdGhyZWFkXG4gICAgTm90ZSBvdmVyIFZpZXdlcixIdWI6IHsgLi4uY2hhbm5lbCBBIHN0YXRlLi4uLCBzaWdBOiAweGMzZiB9XG5cbiAgICBIdWItLT5IdWI6IFdhaXQgZm9yIHBlcmZvcm1lciBjb25maXJtYXRpb25cblxuICAgIFBlcmZvcm1lci0-Pkh1YjogT3BlbiB0aHJlYWRcbiAgICBOb3RlIG92ZXIgUGVyZm9ybWVyLEh1YjogeyAuLi5jaGFubmVsIEIgc3RhdGUuLi4sIHNpZ0E6IDB4YzNmIH1cblxuXG4gICAgSHViLT4-SHViOiBWZXJpZnkgdGhyZWFkIGNyZWF0aW9uIHVwZGF0ZXNcblxuICAgIEh1Yi0-PlZpZXdlcjogQ29uZmlybSB0aHJlYWQgb3BlbmVkXG4gICAgTm90ZSBvdmVyIFZpZXdlcixIdWI6IHsgLi4uY2hhbm5lbCBBIHN0YXRlLi4uLCA8YnI-c2lnQTogMHhjM2YsIDxicj5zaWdJOiAweDNmZSB9XG5cbiAgICBIdWItPj5QZXJmb3JtZXI6IENvbmZpcm0gdGhyZWFkIG9wZW5lZFxuICAgIE5vdGUgb3ZlciBQZXJmb3JtZXIsSHViOiB7IC4uLmNoYW5uZWwgQSBzdGF0ZS4uLiwgPGJyPnNpZ0E6IDB4YzNmLCA8YnI-c2lnSTogMHgzZmUgfVxuXG5cbiAgICBWaWV3ZXItPj5QZXJmb3JtZXI6IFRpcHBpbmchXG4gICAgTm90ZSBvdmVyIFZpZXdlcixQZXJmb3JtZXI6IFRpcCEgPGJyPiBQZXJmb3JtZXIgc2hvdWxkIG9ubHkgbmVlZCBsYXRlc3QgYW5kIGluaXRpYWwgdG8gZGVjb21wb3NlIG9uIGNsb3NlLlxuXG4gICAgVmlld2VyLS0-Vmlld2VyOiBBbGwgZG9uZVxuXG4gICAgVmlld2VyLT4-SHViOiBDbG9zZSB0aHJlYWRcbiAgICBOb3RlIG92ZXIgVmlld2VyLEh1YjogeyAuLi5jaGFubmVsIEEgc3RhdGUuLi4sIHNpZ0E6IDB4YzNmIH1cblxuICAgIEh1Yi0-PlZpZXdlcjogVmVyaWZ5LCBDb3NpZ25cbiAgICBOb3RlIG92ZXIgVmlld2VyLEh1YjogeyAuLi5jaGFubmVsIEEgc3RhdGUuLi4sIDxicj5zaWdBOiAweGMzZiwgPGJyPnNpZ0k6IDB4YzNmIH1cblxuICAgIEh1Yi0-PlBlcmZvcm1lcjogQ2xvc2UgdGhyZWFkXG4gICAgTm90ZSBvdmVyIFBlcmZvcm1lcixIdWI6IHsgLi4uY2hhbm5lbCBCIHN0YXRlLi4uLCBzaWdJOiAweGMzZiB9XG5cbiAgICBQZXJmb3JtZXItPj5IdWI6IFZlcmlmeSwgQ29zaWduXG4gICAgTm90ZSBvdmVyIFBlcmZvcm1lcixIdWI6IHsgLi4uY2hhbm5lbCBCIHN0YXRlLi4uLCA8YnI-c2lnQTogMHhjM2YsIDxicj5zaWdJOiAweGMzZiB9IH1cbiIsIm1lcm1haWQiOnsidGhlbWUiOiJkZWZhdWx0In19).

A thread is opened by reducing the channel balances in the parties' respective channels by the maximum amount that will be transacted in the thread.

- For example: The viewer enters a show with a performer. The camsite automatically opens a thread between the viewer and performer for 10 BOOTY.
    1. First, the viewer's wallet prepares, signs and sends a thread state at `txCount = 0` which contains the amount that they wish to transact:

            weiBalances: [0, 0]
            tokenBalances: [10 BOOTY, 0]
            txCount: 0
            threadID: 0

    2. Then, the viewer prepares, signs and sends a channel state which lowers the channel's balances by the amount to be used in the thread and includes the hash of the initial state above as part of the thread root.

            //if initial tokenBalances for channel between viewer/hub were [30 BOOTY, 10 BOOTY]
            tokenBalances: [20 BOOTY, 10 BOOTY] //note, hub is receiver here
            threadRoot: merkle(hash(threadInitialStates))

    3. The performer validates the initial state and generates a similar corresponding state in it's channel, acting as the receiver with the hub as the sender.
    4. The hub validates both of these channel updates and countersigns.
    5. Then, the viewer is able to tip the performer by generating new thread states in a similar format to the initial thread state above.

Threads are closed offchain following the same procedure but in reverse. First, the viewer submits a channel update reintroducing the final thread balances and removing the thread initial state from thread root to the hub.
<<<<<<< HEAD
=======

//TODO: Check the diagram for close thread consistency. What happens if Alice closes the thread offchain and then Bob disputes it before countersigning the hub's offchain update?
>>>>>>> c1e23937daf93294e5e7e6e74db9549186eb3c4a

## ThreadIDs

Threads are keyed using both sender/receiver addresses as well as a threadId.

    // threads[sender][receiver][threadId]
    mapping(address => mapping(address => mapping(uint256 => Thread))) threads;

When a thread is closed and reopened, the threadId is incremented. This stops replay attacks where an old thread state can be used to dispute a new thread.

## Unidirectional Constraints

We strictly require that all threads are unidirectional. This removes the need for the receiver of a thread to sign any state updates, and incentivizes them to always submit the newest update available to them.

All thread state updates must only increase the recipient's balance and must strictly either increase the recipient's wei balance, token balance or both (in other words, a new state update that does not change balances is not allowed). This requirement is enforced on the contract in the thread disputes, so a thread state update which does not adhere to these guidelines should be considered invalid.

[//TODO](//todo) : Additionally, we also require that all initial thread states set the recipient balances to 0. Since recipient balances can only increase, this constrains the number of cases where malformed states can be generated. (//What other problems exist here?)

# Unilateral Functions
In the event that channel/thread participants cannot mutually agree on a final state to close the channel/thread with, participants can call the unilateral functions to use the contract as an arbitrator and settle the final state of the channel on chain.

In general, we hope and expect that most actual disputes will be resolved offchain. Hubs have an incentive to provide good customer service to retain users and users have an incentive to minimize the cost and time of retreiving funds. Having the _option_ to dispute onchain, however, is what makes this system trust-minimized.

(Ironically, the better our dispute mechanisms and incentives are, the less likely they are to ever be used).

## Channel Disputes
Channel disputes occur between the Hub and a user. The channel dispute process consists of initiating the channel dispute timer with a double-signed state, allowing the counterparty to challenge if a newer state is available, and then finalizing the latest state onchain/distributing funds. Unilateral functions are called in the following order:
1. a. `startExit` begins the channel dispute timer using the latest recorded onchain state; OR
   b. `startExitWithUpdate` begins the channel dispute timer while also submitting a new state update.
2. a. `emptyChannelWithChallenge` (which can only be called by the party that did _not_ initiate the dispute) challenges the channel with a newer state and, if the state is valid, empties the channel. Note that this can happen before the dispute timer expires.
   b. `emptyChannel` (called by any party after the dispute timer expires) empties the channel with the latest available onchain state.

Note that channel disputes are always a two step process. 

The longest time to dispute occurs if a counterparty is unresponsive during the dispute. In that case, the dispute initiator calls `startExit` or `startExitWithUpdate` (depending on whether or not they have an offchain state that is better for them than the latest onchain state) and then calls `emptyChannel` after the timer expires.

The shortest time to dispute occurs if a dispute is initiated by a party (assuming they submitted their most favorable state onchain) and then the counterparty calls `emptyChannelWithChallenge` immediately afterwards with a more recent state that is in their favor. Since the dispute initiator is unable to challenge further, they are incentivized to not attempt a replay attack and just submit the most recent favorable state that they can. This also stops spam.

The reader may note that initiating a dispute with the _actual_ latest state (i.e. a state that both parties agree and _have_ to finalize on) also has a long dispute time. While this may seem counterintuitive, we believe this to be acceptable since, if both parties truly agreed that this is the latest available state, then they should have been able to withdraw funds from the channel without needing to resort to a unilateral process.

## Thread Disputes
Because threads are unidirectional, we expect the likelihood of unavailability-related disputes for threads to be very low. This is good because, in the current construction, it is impossible to dispute a thread onchain without first going through the full channel dispute process:

A part of the state update packet that is passed back and forth in a channel is the current thread root hash. This hash contains the merkel root of all of the initial states of all currently open threads, used to _prove_ that a thread exists when initiating a thread dispute. This means that, in order to dispute a thread, the channel's state first has to be finalized onchain which puts the channel into the `ThreadDispute` status. We also keep track of a `threadCount` variable in channel state which is decremented on thread disputes so that, when it reaches 0, we can set the channel's status back to `Open`.

Like with channels, threads have a dispute timer within which their state must be settled onchain. The additional complexity of threads comes from the fact that threads need to be disputed _atomically_, i.e. that if a thread between Alice-Bob is disputed/settled in Alice's channel with the Hub, then it must be settled in Bob's channel with the Hub as well.

Thread dispute functions look much like the channel dispute ones:
1. a. `startExitThread` takes in a thread's initial state, checks that it's part of the caller's channel's thread root and then starts the thread's dispute timer.
   b. `startExitThreadWithUpdate` does the same as the above, but also takes in, validates, and saves a thread update.
2. `challengeThread` (called by the sender, receiver, or hub) takes a challenging update, validates it and then saves it onchain.
3. `emptyThread` empties the thread in caller's channel and decrements `threadCount`. Note that this function is called twice per thread since a thread is composed of two channels. The `emptied[]` boolean ensures that the thread cannot be emptied into the same channel twice.

The only upper limit on how long it can take for threads to be disputed is a potential `nukeThreads` call. However, since any party to the thread can initiate and settle a dispute on a thread, we expect that _some_ party will always have the incentive to do so as quickly as possible because they will have funds owed to them.

## NukeThreads
There remains a possibility that _some_ threads remain undisputed, either because their contained balance was too low to be worth disputing or because the counterparty to the channel was completely unavailable (we assume that ths is always the user since hubs would auto-respond to disputes).

If this occurs, it is possible for a channel to be stuck in the `ThreadDispute` status forever. And since we key channels by user address, this would effectively lock out that user from interacting with a given hub. The `nukeThreads` function counters these types of cases by hard resetting the channel to the open state and emptying any remaining funds in the channel to the user.

Why not give them to the hub? We assume that the hub will already have disputed any channel/thread where they have funds owed to them since they are automated actors.

# Data Structures

## Global Constants

    address public hub;
    uint256 public challengePeriod;
    ERC20 public approvedToken;`

There is a single privileged `hub` address set at contract deployment which can store ETH/ERC20 reserves on the contract, deposit those reserves into channels, and withdraw any unallocated reserves.

There is a single `challengePeriod` set at contract deployment and is used for all channel and thread disputes.

There is a single `approvedToken` ERC20 token set at contract deployment which is the only token that can be used in channels for the contract. This prevents [reentrancy attacks from user-provided malicious token contracts](https://www.reddit.com/r/ethdev/comments/9mp33i/we_got_spanked_what_we_know_so_far/).

## Constructor

    constructor(
        address _hub,
        uint256 _challengePeriod,
        address _tokenAddress
    ) public {
      hub = _hub;
      challengePeriod = _challengePeriod;
      approvedToken = ERC20(_tokenAddress);
    }

These global constants are all set by the contract constructor at deployment.

## Internal Accounting

    uint256 public totalChannelWei;
    uint256 public totalChannelToken;

The `totalChannelWei` and `totalChannelToken` track the total wei and tokens that has been deposited in channels by the hub and all users. Any wei or tokens balance on the contract above the `totalChannelWei` and `totalChannelToken` is assumed to be hub reserves.

## Modifiers

## onlyHub

Prevents the modified method from being called except by the hub registered during contract construction.

    modifier onlyHub() {
        require(msg.sender == hub);
        _;
    }

## noReentrancy

Creates a mutex around modified methods such that any reentrant calls to modified methods will fail. The mutex is released after the modified method returns.

    modifier noReentrancy() {
        require(!locked, "Reentrant call.");
        locked = true;
        _;
        locked = false;
    }

# Functions

## hubContractWithdraw

Called by the hub to release deposited ETH or ERC20s. Checks to ensure that the hub cannot withdraw more funds than are currently un-allocated to channels. Note: Reserve amount = contract balance minus total channel balance. This is why we don't need to reduce/zero out onchain balances.

```
function hubContractWithdraw(uint256 weiAmount, uint256 tokenAmount) public noReentrancy onlyHub {
    require(
        getHubReserveWei() >= weiAmount,
        "hubContractWithdraw: Contract wei funds not sufficient to withdraw"
    );
    require(
        getHubReserveTokens() >= tokenAmount,
        "hubContractWithdraw: Contract token funds not sufficient to withdraw"
    );

    hub.transfer(weiAmount);
    require(
        approvedToken.transfer(hub, tokenAmount),
        "hubContractWithdraw: Token transfer failure"
    );

    emit DidHubContractWithdraw(weiAmount, tokenAmount);
}
```
## getHubReserveWei

Returns the amount of ETH that the hub can withdraw.
```
function getHubReserveWei() public view returns (uint256) {
    return address(this).balance.sub(totalChannelWei);
}
```
## getHubReserveTokens

Returns the amount of ERC20 tokens that the hub can withdraw.
```
function getHubReserveTokens() public view returns (uint256) {
    return approvedToken.balanceOf(address(this)).sub(totalChannelToken);
}
```
## hubAuthorizedUpdate

`hubAuthorizedUpdate` is called by the hub to update the onchain channel state to reflect the latest mutually signed state update and execute any authorized deposits or withdrawals. It works as follows:

1. It verifies the authorized update using the `_verifyAuthorizedUpdate` function.
2. It verifies the signature provided using `_verifySig` note that we skip hub sig verification here because this is a `hubOnly` function.
3. It updates the channel balances, taking pending updates into account using `_updateChannelBalances`.
4. It transfers the pending withdrawals to the provided `recipient`
5. It stores the new `txCount`, `threadRoot`, and `threadCount`.
6. It emits a `DidUpdateChannel` event.
```
function hubAuthorizedUpdate(
    address user,
    address recipient,
    uint256[2] weiBalances, // [hub, user]
    uint256[2] tokenBalances, // [hub, user]
    uint256[4] pendingWeiUpdates, // [hubDeposit, hubWithdrawal, userDeposit, userWithdrawal]
    uint256[4] pendingTokenUpdates, // [hubDeposit, hubWithdrawal, userDeposit, userWithdrawal]
    uint256[2] txCount, // [global, onchain] persisted onchain even when empty
    bytes32 threadRoot,
    uint256 threadCount,
    uint256 timeout,
    string sigUser
) public noReentrancy onlyHub {
    Channel storage channel = channels[user];

    _verifyAuthorizedUpdate(
        channel,
        txCount,
        weiBalances,
        tokenBalances,
        pendingWeiUpdates,
        pendingTokenUpdates,
        timeout,
        true
    );

    _verifySig(
        [user, recipient],
        weiBalances,
        tokenBalances,
        pendingWeiUpdates, // [hubDeposit, hubWithdrawal, userDeposit, userWithdrawal]
        pendingTokenUpdates, // [hubDeposit, hubWithdrawal, userDeposit, userWithdrawal]
        txCount,
        threadRoot,
        threadCount,
        timeout,
        "", // skip hub sig verification
        sigUser
    );

    _updateChannelBalances(channel, weiBalances, tokenBalances, pendingWeiUpdates, pendingTokenUpdates);

    // transfer wei and token to recipient
    recipient.transfer(pendingWeiUpdates[3]);
    require(approvedToken.transfer(recipient, pendingTokenUpdates[3]), "user token withdrawal transfer failed");

    // update state variables
    channel.txCount = txCount;
    channel.threadRoot = threadRoot;
    channel.threadCount = threadCount;

    emit DidUpdateChannel(
        user,
        0, // senderIdx
        weiBalances,
        tokenBalances,
        pendingWeiUpdates,
        pendingTokenUpdates,
        txCount,
        threadRoot,
        threadCount,
        timeout
    );
}
```
## userAuthorizedUpdate

Similar to `hubAuthorizedUpdate`, `userAuthorizedUpdate` is called by the user to update the onchain channel state to reflect the latest mutually signed state update and execute any authorized deposits or withdrawals. The mechanism is very similar to `hubAuthorizedUpdate`, but the function verifies the hub's sig instead.

Note: we do not need to verify user's sig because we are searching channel by `msg.sender`.
```
function userAuthorizedUpdate(
    address recipient,
    uint256[2] weiBalances, // [hub, user]
    uint256[2] tokenBalances, // [hub, user]
    uint256[4] pendingWeiUpdates, // [hubDeposit, hubWithdrawal, userDeposit, userWithdrawal]
    uint256[4] pendingTokenUpdates, // [hubDeposit, hubWithdrawal, userDeposit, userWithdrawal]
    uint256[2] txCount, // persisted onchain even when empty
    bytes32 threadRoot,
    uint256 threadCount,
    uint256 timeout,
    string sigHub
) public payable noReentrancy {
    require(msg.value == pendingWeiUpdates[2], "msg.value is not equal to pending user deposit");

    Channel storage channel = channels[msg.sender];

    _verifyAuthorizedUpdate(
        channel,
        txCount,
        weiBalances,
        tokenBalances,
        pendingWeiUpdates,
        pendingTokenUpdates,
        timeout,
        false
    );

    _verifySig(
        [msg.sender, recipient],
        weiBalances,
        tokenBalances,
        pendingWeiUpdates, // [hubDeposit, hubWithdrawal, userDeposit, userWithdrawal]
        pendingTokenUpdates, // [hubDeposit, hubWithdrawal, userDeposit, userWithdrawal]
        txCount,
        threadRoot,
        threadCount,
        timeout,
        sigHub,
        "" // skip user sig verification
    );

    // transfer user token deposit to this contract
    require(approvedToken.transferFrom(msg.sender, address(this), pendingTokenUpdates[2]), "user token deposit failed");

    _updateChannelBalances(channel, weiBalances, tokenBalances, pendingWeiUpdates, pendingTokenUpdates);

    // transfer wei and token to recipient
    recipient.transfer(pendingWeiUpdates[3]);
    require(approvedToken.transfer(recipient, pendingTokenUpdates[3]), "user token withdrawal transfer failed");

    // update state variables
    channel.txCount = txCount;
    channel.threadRoot = threadRoot;
    channel.threadCount = threadCount;

    emit DidUpdateChannel(
        msg.sender,
        1, // senderIdx
        weiBalances,
        tokenBalances,
        pendingWeiUpdates,
        pendingTokenUpdates,
        txCount,
        threadRoot,
        threadCount,
        timeout
    );
}
```
## startExit

Begins the unilateral channel withdrawal process for the currently-stored onchain state. In other words, if the onchain recorded state (from a deposit or withdraw) is the latest recorded state, this allows a disputer to start the timer to exit using that state rather than passing in their own. The process starts as follows:

1. The channel's state is verified to be `Status.Open`.
2. `msg.sender` is verified to be either the hub or the user.
3. The `exitInitiator` field is set to `msg.sender`.
4. The `channelClosingTime` field is set to `now` + `challengePeriod`.
5. The status is set to `Status.ChannelDispute`.
6. Emits `DidStartExitChannel` event.
```
function startExit(
    address user
) public noReentrancy {
    Channel storage channel = channels[user];
    require(channel.status == Status.Open, "channel must be open");

    require(msg.sender == hub || msg.sender == user, "exit initiator must be user or hub");

    channel.exitInitiator = msg.sender;
    channel.channelClosingTime = now.add(challengePeriod);
    channel.status = Status.ChannelDispute;

    emit DidStartExitChannel(
        user,
        msg.sender == hub ? 0 : 1,
        [channel.weiBalances[0], channel.weiBalances[1]],
        [channel.tokenBalances[0], channel.tokenBalances[1]],
        channel.txCount,
        channel.threadCount,
        channel.exitInitiator
    );
}
```
## startExitWithUpdate

Begins the unilateral channel withdrawal process with the provided offchain state. In other words, this is called when a disputer wants to exit with a mutually signed offchain state that is at a higher `txCount` than the onchain state. The process works as follows:

1. The channel's state is verified to be `Status.Open`.
2. `msg.sender` is verified to be either the hub or the user
3. The provided state's `timeout` is verified to be zero. Note that no time-sensitive states can be disputed.
4. Hub and user signatures are verified.
5. The `txCount` field is verified as per the rules described in `_verifyAuthorizedUpdate`.
6. The balances are verified to not exceed the channel's total balances
7. In the case where the onchain `txCount` equals the provided onchain `txCount`(i.e. a deposit/withdraw has happened onchain), the provided offchain state is force-updated using `_applyPendingUpdates`. Otherwise, pending withdrawals are rolled back into the offchain balances using `_revertPendingUpdates`.
8. `txCount`, `threadRoot` and `threadCount` are updated.
9. The `exitInitiator` field is set to `msg.sender`.
10. The `channelClosingTime` field is set to `now` + `challengePeriod`.
11. The status is set to `Status.ChannelDispute`.
12. Emits `DidStartExitChannel` event.
```
function startExitWithUpdate(
    address[2] user, // [user, recipient]
    uint256[2] weiBalances, // [hub, user]
    uint256[2] tokenBalances, // [hub, user]
    uint256[4] pendingWeiUpdates, // [hubDeposit, hubWithdrawal, userDeposit, userWithdrawal]
    uint256[4] pendingTokenUpdates, // [hubDeposit, hubWithdrawal, userDeposit, userWithdrawal]
    uint256[2] txCount, // [global, onchain] persisted onchain even when empty
    bytes32 threadRoot,
    uint256 threadCount,
    uint256 timeout,
    string sigHub,
    string sigUser
) public noReentrancy {
    Channel storage channel = channels[user[0]];
    require(channel.status == Status.Open, "channel must be open");

    require(msg.sender == hub || msg.sender == user[0], "exit initiator must be user or hub");

    require(timeout == 0, "can't start exit with time-sensitive states");

    _verifySig(
        user,
        weiBalances,
        tokenBalances,
        pendingWeiUpdates, // [hubDeposit, hubWithdrawal, userDeposit, userWithdrawal]
        pendingTokenUpdates, // [hubDeposit, hubWithdrawal, userDeposit, userWithdrawal]
        txCount,
        threadRoot,
        threadCount,
        timeout,
        sigHub,
        sigUser
    );

    require(txCount[0] > channel.txCount[0], "global txCount must be higher than the current global txCount");
    require(txCount[1] >= channel.txCount[1], "onchain txCount must be higher or equal to the current onchain txCount");

    // offchain wei/token balances do not exceed onchain total wei/token
    require(weiBalances[0].add(weiBalances[1]) <= channel.weiBalances[2], "wei must be conserved");
    require(tokenBalances[0].add(tokenBalances[1]) <= channel.tokenBalances[2], "tokens must be conserved");

    // pending onchain txs have been executed - force update offchain state to reflect this
    if (txCount[1] == channel.txCount[1]) {
        _applyPendingUpdates(channel.weiBalances, weiBalances, pendingWeiUpdates);
        _applyPendingUpdates(channel.tokenBalances, tokenBalances, pendingTokenUpdates);
    // pending onchain txs have *not* been executed - revert pending deposits and withdrawals back into offchain balances
    } else { //txCount[1] > channel.txCount[1]
        _revertPendingUpdates(channel.weiBalances, weiBalances, pendingWeiUpdates);
        _revertPendingUpdates(channel.tokenBalances, tokenBalances, pendingTokenUpdates);
    }

    // update state variables
    channel.txCount = txCount;
    channel.threadRoot = threadRoot;
    channel.threadCount = threadCount;

    channel.exitInitiator = msg.sender;
    channel.channelClosingTime = now.add(challengePeriod);
    channel.status == Status.ChannelDispute;

    emit DidStartExitChannel(
        user[0],
        msg.sender == hub ? 0 : 1,
        [channel.weiBalances[0], channel.weiBalances[1]],
        [channel.tokenBalances[0], channel.tokenBalances[1]],
        channel.txCount,
        channel.threadCount,
        channel.exitInitiator
    );
}
```
# emptyChannelWithChallenge

`emptyChannelWithChallenge` performs the second round in the the unilateral withdrawal game. In this case, the challenging user presents a later authorized state than was presented in `startExitWithUpdate`. Only the user who did not start the exit may call this method.

1. Verifies that the channel is in dispute and that the closing time has not yet expired.
2. Verifies that the `msg.sender` is not the initiator of the dispute and that it is either the hub or the user.
3. Verifies that the caller is not attempting to exit with a time-sensitive state (user deposit, exchange).
4. Verifies both signers from the state and sigs.
5. Verifies that the `txCount`s must be accurate (subject to the logic presented in `hubAuthorizedUpdate` above.
6. Verifies that balances are conserved.
7. In the case where the onchain `txCount` equals the provided onchain `txCount`(i.e. a deposit/withdraw has happened onchain), the provided offchain state is force-updated using `_applyPendingUpdates`. Otherwise, pending withdrawals are rolled back into the offchain balances using `_revertPendingUpdates`.
8. Deducts balances from the total onchain recorded balances for the channel.
9. Transfers balances to both parties respectively.
10. Updates `txCount` , `threadRoot` and `threadCount` state variables.
11. If there are no threads open, reopens the channel so that it can be used again. We don't have to zero `threadRoot` here because it is assumed to be empty if there are no threads open.
12. Otherwise, changes the channel's state to `ThreadDispute`.
13. Reinitializes the exit initiator variable since the channel dispute process has been completed.
14. Emits the `DidEmptyChannelWithChallenge` event.
```
function emptyChannelWithChallenge(
    address[2] user,
    uint256[2] weiBalances, // [hub, user]
    uint256[2] tokenBalances, // [hub, user]
    uint256[4] pendingWeiUpdates, // [hubDeposit, hubWithdrawal, userDeposit, userWithdrawal]
    uint256[4] pendingTokenUpdates, // [hubDeposit, hubWithdrawal, userDeposit, userWithdrawal]
    uint256[2] txCount, // persisted onchain even when empty
    bytes32 threadRoot,
    uint256 threadCount,
    uint256 timeout,
    string sigHub,
    string sigUser
) public noReentrancy {
    Channel storage channel = channels[user[0]];
    require(channel.status == ChannelStatus.ChannelDispute, "channel must be in dispute");
    require(now < channel.channelClosingTime, "channel closing time must not have passed");

    require(msg.sender != channel.exitInitiator, "challenger can not be exit initiator");
    require(msg.sender == hub || msg.sender == user[0], "challenger must be either user or hub");

    require(timeout == 0, "can't start exit with time-sensitive states");

    _verifySig(
        user,
        weiBalances,
        tokenBalances,
        pendingWeiUpdates, // [hubDeposit, hubWithdrawal, userDeposit, userWithdrawal]
        pendingTokenUpdates, // [hubDeposit, hubWithdrawal, userDeposit, userWithdrawal]
        txCount,
        threadRoot,
        threadCount,
        timeout,
        sigHub,
        sigUser,
        [true, true] // [checkHubSig?, checkUser] <- check both sigs
    );

    require(txCount[0] > channel.txCount[0], "global txCount must be higher than the current global txCount");
    require(txCount[1] >= channel.txCount[1], "onchain txCount must be higher or equal to the current onchain txCount");

    // offchain wei/token balances do not exceed onchain total wei/token
    require(weiBalances[0].add(weiBalances[1]) <= channel.weiBalances[2], "wei must be conserved");
    require(tokenBalances[0].add(tokenBalances[1]) <= channel.tokenBalances[2], "tokens must be conserved");

    // pending onchain txs have been executed - force update offchain state to reflect this
    if (txCount[1] == channel.txCount[1]) {
        _applyPendingUpdates(channel.weiBalances, weiBalances, pendingWeiUpdates);
        _applyPendingUpdates(channel.tokenBalances, tokenBalances, pendingTokenUpdates);
    // pending onchain txs have *not* been executed - revert pending deposits and withdrawals back into offchain balances
    } else { //txCount[1] > channel.txCount[1]
        _revertPendingUpdates(channel.weiBalances, weiBalances, pendingWeiUpdates);
        _revertPendingUpdates(channel.tokenBalances, tokenBalances, pendingTokenUpdates);
    }

    // deduct hub/user wei/tokens from total channel balances
    channel.weiBalances[2] = channel.weiBalances[2].sub(channel.weiBalances[0]).sub(channel.weiBalances[1]);
    channel.tokenBalances[2] = channel.tokenBalances[2].sub(channel.tokenBalances[0]).sub(channel.tokenBalances[1]);

    // transfer hub wei balance from channel to reserves
    totalChannelWei = totalChannelWei.sub(channel.weiBalances[0]).sub(channel.weiBalances[1]);
    // transfer user wei balance to user
    user[0].transfer(channel.weiBalances[1]);
    channel.weiBalances[0] = 0;
    channel.weiBalances[1] = 0;

    // transfer hub token balance from channel to reserves
    totalChannelToken = totalChannelToken.sub(channel.tokenBalances[0]).sub(channel.tokenBalances[1]);
    // transfer user token balance to user
    require(approvedToken.transfer(user[0], channel.tokenBalances[1]), "user token withdrawal transfer failed");
    channel.tokenBalances[0] = 0;
    channel.tokenBalances[1] = 0;

    // update state variables
    channel.txCount = txCount;
    channel.threadRoot = threadRoot;
    channel.threadCount = threadCount;

    if (channel.threadCount > 0) {
        channel.status = ChannelStatus.ThreadDispute;
    } else {
        channel.channelClosingTime = 0;
        channel.status = ChannelStatus.Open;
    }

    channel.exitInitiator = address(0x0);

    emit DidEmptyChannel(
        user[0],
        msg.sender == hub ? 0 : 1,
        [channel.weiBalances[0], channel.weiBalances[1]],
        [channel.tokenBalances[0], channel.tokenBalances[1]],
        channel.txCount,
        channel.threadRoot,
        channel.threadCount
    );
}
```
## emptyChannel

Called by any party when the channel dispute timer expires. Uses the latest available onchain state to transfer values.

1. Verifies that the channel is in dispute and that the closing time has expired.
2. Deducts the onchain balances from the total recorded balance of the channel.
3. Transfers the onchain balances to their respective parties.
4. If there are no threads open, zeroes out the thread closing time and reopens the channel so that it can be used again. We don't have to zero `threadRoot` here because it is assumed to not contain anything if there were no open threads.
5. Otherwise, sets the thread dispute time and changes the channel's state to `ThreadDispute`.
6. Reinitializes the exit initiator variables since the channel dispute process has been completed.
7. Emits the `DidEmptyChannel` event.
```
function emptyChannel(
    address user
) public noReentrancy {
    require(user != hub, "user can not be hub");
    require(user != address(this), "user can not be channel manager");

    Channel storage channel = channels[user];
    require(channel.status == ChannelStatus.ChannelDispute, "channel must be in dispute");

    require(
      channel.channelClosingTime < now ||
      msg.sender != channel.exitInitiator && (msg.sender == hub || msg.sender == user),
      "channel closing time must have passed or msg.sender must be non-exit-initiating party"
    );

    // deduct hub/user wei/tokens from total channel balances
    channel.weiBalances[2] = channel.weiBalances[2].sub(channel.weiBalances[0]).sub(channel.weiBalances[1]);
    channel.tokenBalances[2] = channel.tokenBalances[2].sub(channel.tokenBalances[0]).sub(channel.tokenBalances[1]);

    // transfer hub wei balance from channel to reserves
    totalChannelWei = totalChannelWei.sub(channel.weiBalances[0]).sub(channel.weiBalances[1]);
    // transfer user wei balance to user
    user.transfer(channel.weiBalances[1]);
    channel.weiBalances[0] = 0;
    channel.weiBalances[1] = 0;

    // transfer hub token balance from channel to reserves
    totalChannelToken = totalChannelToken.sub(channel.tokenBalances[0]).sub(channel.tokenBalances[1]);
    // transfer user token balance to user
    require(approvedToken.transfer(user, channel.tokenBalances[1]), "user token withdrawal transfer failed");
    channel.tokenBalances[0] = 0;
    channel.tokenBalances[1] = 0;

    if (channel.threadCount > 0) {
        channel.status = ChannelStatus.ThreadDispute;
    } else {
        channel.channelClosingTime = 0;
        channel.status = ChannelStatus.Open;
    }

    channel.exitInitiator = address(0x0);

    emit DidEmptyChannel(
        user,
        msg.sender == hub ? 0 : 1,
        [channel.weiBalances[0], channel.weiBalances[1]],
        [channel.tokenBalances[0], channel.tokenBalances[1]],
        channel.txCount,
        channel.threadRoot,
        channel.threadCount
    );
}
```
## startExitThread

Initializes the thread onchain to prep it for dispute (called when no newer state update is available). This is the thread corollary to `startExit` for channel.

1. Verifies that the channel is in the `ThreadDispute` state.
2. Verifies that it is being called by either the hub or the user.
3. Verifies that the provided `user` is either the sender or the receiver in the channel.
4. Verifies that the initial receiver balances are zero.
5. Verifies that the thread dispute timer is 0 (i.e. that the thread with that threadID is not already in dispute).
6. Verifies the signature that is submitted to ensure that it belongs to the sender and verifies that the initial state of this thread is contained in the recorded `threadRoot` using `_verifyThread.`
7. Updates the thread state onchain and starts the `threadClosingTime` timer.
8. Emits the `DidStartExitThread` event.
```
function startExitThread(
    address user,
    address sender,
    address receiver,
    uint256 threadId,
    uint256[2] weiBalances, // [sender, receiver]
    uint256[2] tokenBalances, // [sender, receiver]
    bytes proof,
    string sig
) public noReentrancy {
    Channel storage channel = channels[user];
    require(channel.status == ChannelStatus.ThreadDispute, "channel must be in thread dispute phase");
    require(msg.sender == hub || msg.sender == user, "thread exit initiator must be user or hub");
    require(user == sender || user == receiver, "user must be thread sender or receiver");

    require(weiBalances[1] == 0 && tokenBalances[1] == 0, "initial receiver balances must be zero");

    Thread storage thread = threads[sender][receiver][threadId];

    require(thread.threadClosingTime == 0, "thread closing time must be zero");

    _verifyThread(sender, receiver, threadId, weiBalances, tokenBalances, 0, proof, sig, channel.threadRoot);

    thread.weiBalances = weiBalances;
    thread.tokenBalances = tokenBalances;
    thread.threadClosingTime = now.add(challengePeriod);

    emit DidStartExitThread(
        user,
        sender,
        receiver,
        threadId,
        msg.sender,
        thread.weiBalances,
        thread.tokenBalances,
        thread.txCount
    );
}
```
## startExitThreadWithUpdate

Initializes thread state onchain and immediately updates it. This is called when a party wants to dispute a thread and also has a state beyond just the initial state. The channel corollary is `startExitWithUpdate`

1. Verifies that the channel is in the `ThreadDispute` status.
2. Verifies that the message sender is either the hub or the user.
3. Verifies that the provided `user` is either the sender or receiver in the thread.
4. Verifies that the initial receiver balances are zero.
5. Verifies that the thread timer is zero.
6. Verifies the thread using the `_verifyThread` method: recreates the signature and recovers signer, then checks that the initial state is part of the `threadRoot`.
7. Verifies that the transaction count for the updated state is greater than 0 (`txCount` of initial state).
8. Verifies that the total wei and token balances must be equal to the initial total wei and token balances (i.e. value is conserved). Note that since initial receiver balances have to be zero (see 4 above), for the initial state, "sender balance" and "total balance" are the same.
9. Verifies that the update only *increases* the value of the receiver and strictly requires that either wei or token balance increases. This is because threads are *unidirectional*: value can only move from sender→receiver. Doing this removes the need for a signature from the receiver.
10. Verifies that the signature of the updated thread state using the `_verifyThread` method. Note that the `threadRoot` is set to `bytes32(0x0)`because a merkle proof is not needed for the not-initial state.
11. Updates the thread state onchain and starts the thread dispute timer.
12. Emits the `DidStartExitThread` event.
```
function startExitThreadWithUpdate(
    address user,
    address[2] threadMembers, //[sender, receiver]
    uint256 threadId,
    uint256[2] weiBalances, // [sender, receiver]
    uint256[2] tokenBalances, // [sender, receiver]
    bytes proof,
    string sig,
    uint256[2] updatedWeiBalances, // [sender, receiver]
    uint256[2] updatedTokenBalances, // [sender, receiver]
    uint256 updatedTxCount,
    string updateSig
) public noReentrancy {
    Channel storage channel = channels[user];
    require(channel.status == ChannelStatus.ThreadDispute, "channel must be in thread dispute phase");
    require(msg.sender == hub || msg.sender == user, "thread exit initiator must be user or hub");
    require(user == threadMembers[0] || user == threadMembers[1], "user must be thread sender or receiver");

    require(weiBalances[1] == 0 && tokenBalances[1] == 0, "initial receiver balances must be zero");

    Thread storage thread = threads[threadMembers[0]][threadMembers[1]][threadId];
    require(thread.threadClosingTime == 0, "thread closing time must be zero");

    _verifyThread(threadMembers[0], threadMembers[1], threadId, weiBalances, tokenBalances, 0, proof, sig, channel.threadRoot);

    // *********************
    // PROCESS THREAD UPDATE
    // *********************

    require(updatedTxCount > 0, "updated thread txCount must be higher than 0");
    require(updatedWeiBalances[0].add(updatedWeiBalances[1]) == weiBalances[0], "sum of updated wei balances must match sender's initial wei balance");
    require(updatedTokenBalances[0].add(updatedTokenBalances[1]) == tokenBalances[0], "sum of updated token balances must match sender's initial token balance");

    require(updatedWeiBalances[1] > 0 || updatedTokenBalances[1] > 0, "receiver balances may never decrease and either wei or token balance must strictly increase");

    // Note: explicitly set threadRoot == 0x0 because then it doesn't get checked by _isContained (updated state is not part of root)
    _verifyThread(threadMembers[0], threadMembers[1], threadId, updatedWeiBalances, updatedTokenBalances, updatedTxCount, "", updateSig, bytes32(0x0));

    thread.weiBalances = updatedWeiBalances;
    thread.tokenBalances = updatedTokenBalances;
    thread.txCount = updatedTxCount;
    thread.threadClosingTime = now.add(challengePeriod);

    emit DidStartExitThread(
        user,
        threadMembers[0],
        threadMembers[1],
        threadId,
        msg.sender == hub ? 0 : 1,
        thread.weiBalances,
        thread.tokenBalances,
        thread.txCount
    );
}
```
## challengeThread

Lets any party submit a challenge to the previously recorded onchain state for the thread so long as dispute timer has not passed. To protect against parties calling `startExitThreadWithUpdate` immediately before the `threadClosingTime` expires, counterparties should start the thread exit process themselves and prepare to challenge if they have funds owed to them in the thread.

1. Verifies that the channel is in the `ThreadDispute` state.
2. Verifies that the `msg.sender` is either the hub, sender or receiver in the thread.
3. Verifies that the thread dispute timer has not yet passed and that the transaction count provided is greater than the onchain `txCount` for the thread.
4. Verifies that the total submitted balances are equal to the total onchain recorded balances from the initial state.
5. Verifies that the update only *increases* the value of the receiver and strictly increases either wei or token balance. This is because threads are *unidirectional*: value can only move from sender→receiver. Doing this removes the need for a signature from the receiver.
6. Verifies the signature using `_verifyThread`.
7. Updates the thread's balances and `txCount` onchain.
8. Emits `DidChallengeThread` event.
```
function challengeThread(
    address sender,
    address receiver,
    uint256 threadId,
    uint256[2] weiBalances, // updated weiBalances
    uint256[2] tokenBalances, // updated tokenBalances
    uint256 txCount,
    string sig
) public noReentrancy {
    require(msg.sender == hub || msg.sender == sender || msg.sender == receiver, "only hub, sender, or receiver can call this function");

    Thread storage thread = threads[sender][receiver][threadId];
    //verify that thread settlement period has not yet expired
    require(now < thread.threadClosingTime, "thread closing time must not have passed");

    // assumes that the non-sender has a later thread state than what was being proposed when the thread exit started
    require(txCount > thread.txCount, "thread txCount must be higher than the current thread txCount");
    require(weiBalances[0].add(weiBalances[1]) == thread.weiBalances[0].add(thread.weiBalances[1]), "updated wei balances must match sum of thread wei balances");
    require(tokenBalances[0].add(tokenBalances[1]) == thread.tokenBalances[0].add(thread.tokenBalances[1]), "updated token balances must match sum of thread token balances");

    require(
      weiBalances[1] >  thread.weiBalances[1] && tokenBalances[1] >= thread.tokenBalances[1] ||
      weiBalances[1] >= thread.weiBalances[1] && tokenBalances[1] >  thread.tokenBalances[1],
      "receiver balances may never decrease and either wei or token balance must strictly increase"
    );

    // Note: explicitly set threadRoot == 0x0 because then it doesn't get checked by _isContained (updated state is not part of root)
    _verifyThread(sender, receiver, threadId, weiBalances, tokenBalances, txCount, "", sig, bytes32(0x0));

    // save the thread balances and txCount
    thread.weiBalances = weiBalances;
    thread.tokenBalances = tokenBalances;
    thread.txCount = txCount;

    emit DidChallengeThread(
        sender,
        receiver,
        threadId,
        msg.sender,
        thread.weiBalances,
        thread.tokenBalances,
        thread.txCount
    );
}
```
## emptyThread

<<<<<<< HEAD
Called by any party when the thread dispute timer expires. Uses the latest available onchain state to transfer values. Corollary is `emptyChannel`. Note: this can be called twice per thread; once for each channel.

1. Verifies that the channel state is in `ThreadDispute`.
2. Verifies that the caller of the function is either the hub or the user.
3. Verifies that the provided `user` is either the sender or receiver in the thread.
4. Verifies that the initial receiver balances are zero.
5. Verifies that the thread dispute timer has expired.
6. Verifies that the thread has not already been emptied before for the caller's channel.
7. Verifies the initial state of the thread and checks that it's a part of the user's channel. This is primarily done in case an already settled thread is being emptied by the thread counterparty.
8. Verifies that balances are conserved.
9. Deducts the onchain thread balances from the onchain channel balances for the provided user's channel.
10. Deducts the onchain thread balances from the global total onchain channel balances (i.e. moves balances back into the hub's reserve) and then transfers onchain thread balances to their respective owners. Note: state is not zeroed out here in order to allow for the other party to call `emptyThread` if needed.
11. Records that the thread has been emptied for this user's channel which stops reentry of this function.
12. Decrements the thread count and if the thread count is zero, reopens the channel, reinitializes `threadRoot`, and resets dispute fields.
=======
Called by any party when the thread dispute timer expires. Uses the latest available onchain state to transfer values. Corollary is `emptyChannel`.

1. Verifies that the channel state is in `ThreadDispute` and that the thread closing time for the provided user has expired.
2. Verifies that the thread is exiting. No need to verify anything else since we just use already verified onchain state.
3. Deducts the onchain thread balances from the onchain channel balances for the provided user's channel.
4. Deducts the onchain thread balances from the global total onchain channel balances (i.e. moves balances back into the hub's reserve) and then transfers onchain thread balances to their respective owners. Note: state is not zeroed out here in order to allow for `exitSettledThread` to be called by thread counterparty in the event of a separate dispute in the counterparty's channel.
5. Updates the thread's status to `Settled` which stops reentry to this function.
6. Decrements the thread count and if the thread count is zero, reopens the channel, reinitializes `threadRoot`, and resets dispute fields.
>>>>>>> c1e23937daf93294e5e7e6e74db9549186eb3c4a
```
function emptyThread(
    address user,
    address sender,
    address receiver,
    uint256 threadId,
    uint256[2] weiBalances, // [sender, receiver] -> initial balances
    uint256[2] tokenBalances, // [sender, receiver] -> initial balances
    bytes proof,
    string sig
) public noReentrancy {
    Channel storage channel = channels[user];
    require(channel.status == ChannelStatus.ThreadDispute, "channel must be in thread dispute");
    require(msg.sender == hub || msg.sender == user, "thread exit initiator must be user or hub");
    require(user == sender || user == receiver, "user must be thread sender or receiver");

    require(weiBalances[1] == 0 && tokenBalances[1] == 0, "initial receiver balances must be zero");

    Thread storage thread = threads[sender][receiver][threadId];

    // We check to make sure that the thread state has been finalized
    require(thread.threadClosingTime != 0 && thread.threadClosingTime < now, "Thread closing time must have passed");

    // Make sure user has not emptied before
    require(!thread.emptied[user == sender ? 0 : 1], "user cannot empty twice");

    // verify initial thread state.
    _verifyThread(sender, receiver, threadId, weiBalances, tokenBalances, 0, proof, sig, channel.threadRoot);

    require(thread.weiBalances[0].add(thread.weiBalances[1]) == weiBalances[0], "sum of thread wei balances must match sender's initial wei balance");
    require(thread.tokenBalances[0].add(thread.tokenBalances[1]) == tokenBalances[0], "sum of thread token balances must match sender's initial token balance");

    // deduct sender/receiver wei/tokens about to be emptied from the thread from the total channel balances
    channel.weiBalances[2] = channel.weiBalances[2].sub(thread.weiBalances[0]).sub(thread.weiBalances[1]);
    channel.tokenBalances[2] = channel.tokenBalances[2].sub(thread.tokenBalances[0]).sub(thread.tokenBalances[1]);

    // deduct wei balances from total channel wei and reset thread balances
    totalChannelWei = totalChannelWei.sub(thread.weiBalances[0]).sub(thread.weiBalances[1]);

    // if user is receiver, send them receiver wei balance
    if (user == receiver) {
        user.transfer(thread.weiBalances[1]);
    // if user is sender, send them remaining sender wei balance
    } else if (user == sender) {
        user.transfer(thread.weiBalances[0]);
    }

    // deduct token balances from channel total balances and reset thread balances
    totalChannelToken = totalChannelToken.sub(thread.tokenBalances[0]).sub(thread.tokenBalances[1]);

    // if user is receiver, send them receiver token balance
    if (user == receiver) {
        require(approvedToken.transfer(user, thread.tokenBalances[1]), "user [receiver] token withdrawal transfer failed");
    // if user is sender, send them remaining sender token balance
    } else if (user == sender) {
        require(approvedToken.transfer(user, thread.tokenBalances[0]), "user [sender] token withdrawal transfer failed");
    }

    // Record that user has emptied
    thread.emptied[user == sender ? 0 : 1] = true;

    // decrement the channel threadCount
    channel.threadCount = channel.threadCount.sub(1);

    // if this is the last thread being emptied, re-open the channel
    if (channel.threadCount == 0) {
        channel.threadRoot = bytes32(0x0);
        channel.channelClosingTime = 0;
        channel.status = ChannelStatus.Open;
    }

    emit DidEmptyThread(
        user,
        sender,
        receiver,
        threadId,
        msg.sender,
        [channel.weiBalances[0], channel.weiBalances[1]],
        [channel.tokenBalances[0], channel.tokenBalances[1]],
        channel.txCount,
        channel.threadRoot,
        channel.threadCount
    );
}
```
## nukeThreads

Called in the event that threads reach an unsettleable state because they were not disputed in time. After 10 challenge periods, hard resets the channel state to being open (causes the user to lose access to the funds in any remaining open threads).

1. Verifies that the channel is in `ThreadDispute` and that 10 challenge periods have passed since the `channelClosingTime`.
2. Transfers any remaining channel balances recorded onchain to the user.
3. Zeroes out the total channel balances. Note: there is no need to zero out the other elements of those balances because they will always have been zeroed in other functions.
4. Resets all other channel state params and sets the channel status to `Open`.
5. Emits the `DidNukeThreads` event.
```
function nukeThreads(
    address user
) public noReentrancy {
    Channel storage channel = channels[user];
    require(channel.status == Status.ThreadDispute, "channel must be in thread dispute");
    require(channel.threadClosingTime.add(challengePeriod.mul(10)) < now, "thread closing time must have passed by 10 challenge periods");

    // transfer any remaining channel wei to user
    totalChannelWei = totalChannelWei.sub(channel.weiBalances[2]);
    user.transfer(channel.weiBalances[2]);
    uint256 weiAmount = channel.weiBalances[2];
    channel.weiBalances[2] = 0;

    // transfer any remaining channel tokens to user
    totalChannelToken = totalChannelToken.sub(channel.tokenBalances[2]);
    require(approvedToken.transfer(user, channel.tokenBalances[2]), "user token withdrawal transfer failed");
    uint256 tokenAmount = channel.tokenBalances[2];
    channel.tokenBalances[2] = 0;

    // reset channel params
    channel.threadCount = 0;
    channel.threadRoot = bytes32(0x0);
    channel.threadClosingTime = 0;
    channel.status = Status.Open;

    emit DidNukeThreads(
        user,
        msg.sender,
        weiAmount,
        tokenAmount,
        [channel.weiBalances[0], channel.weiBalances[1]],
        [channel.tokenBalances[0], channel.tokenBalances[1]],
        channel.txCount,
        channel.threadRoot,
        channel.threadCount
    );
}
```
Note: we believe there is an attack vector with this method:

1. User deposits 0.5 ETH into the channel.
2. User open 5 threads with 0.1 ETH each.
3. User disputes 2 of them, and lets 3 expire. The hub doesn't have these states since they have not been disputed.
4. User calls nukeThreads.
5. User deposit 0.5 ETH into the channel again.
6. User opens the 3 same expired threads again.
7. User replay attacks the expired threads with their state that the hub doesn't know about.

In practice, this would be tough to do because the hub should at the very least have the initial agreed-upon thread state, so the hub would be able to call `startExitThread` with the initial state and then `emptyThread` after the `threadClosingTime` has passed. If the hub loses its thread states, that's the hub's fault.

## _verifyAuthorizedUpdate

Internal view function that verifies the authorized update. Called by hub and user authorized update functions.

1. It verifies that the channel is open.
2. It verifies that the timeout is either 0 or has not yet expired.
3. It verifies that the incoming `txCount` variables conform to the following rules:
    1. The provided global `txCount` must always be strictly higher than the stored global `txCount`. This is because the global `txCount` is expected to increment for every state update.
    2. The provided onchain `txCount` must be greater than or equal to the stored onchain `txCount`. This is because the onchain count only increases in the event of an onchain transaction, and the vast majority of updates will be handled offchain.
4. Verifies that the submitted balances do not exceed onchain recorded balances.
5. It verifies that the contract holds enough Ether or tokens to collateralize the state update.
6. It verifies that the proposed balance updates less withdrawals do not exceed the onchain balances + deposits.
```
function _verifyAuthorizedUpdate(
    Channel storage channel,
    uint256[2] txCount,
    uint256[2] weiBalances,
    uint256[2] tokenBalances, // [hub, user]
    uint256[4] pendingWeiUpdates, // [hubDeposit, hubWithdrawal, userDeposit, userWithdrawal]
    uint256[4] pendingTokenUpdates, // [hubDeposit, hubWithdrawal, userDeposit, userWithdrawal]
    uint256 timeout,
    bool isHub
) internal view {
    require(channel.status == Status.Open, "channel must be open");

    // Usage:
    // 1. exchange operations to protect user from exchange rate fluctuations
    require(timeout == 0 || now < timeout, "the timeout must be zero or not have passed");

    require(txCount[0] > channel.txCount[0], "global txCount must be higher than the current global txCount");
    require(txCount[1] >= channel.txCount[1], "onchain txCount must be higher or equal to the current onchain txCount");

    // offchain wei/token balances do not exceed onchain total wei/token
    require(weiBalances[0].add(weiBalances[1]) <= channel.weiBalances[2], "wei must be conserved");
    require(tokenBalances[0].add(tokenBalances[1]) <= channel.tokenBalances[2], "tokens must be conserved");

    // hub has enough reserves for wei/token deposits for both the user and itself (if isHub, user deposit comes from hub)
    if (isHub) {
        require(pendingWeiUpdates[0].add(pendingWeiUpdates[2]) <= getHubReserveWei(), "insufficient reserve wei for deposits");
        require(pendingTokenUpdates[0].add(pendingTokenUpdates[2]) <= getHubReserveTokens(), "insufficient reserve tokens for deposits");
    // hub has enough reserves for only its own wei/token deposits
    } else {
        require(pendingWeiUpdates[0] <= getHubReserveWei(), "insufficient reserve wei for deposits");
        require(pendingTokenUpdates[0] <= getHubReserveTokens(), "insufficient reserve tokens for deposits");
    }

    // wei is conserved - the current total channel wei + both deposits > final balances + both withdrawals
    require(channel.weiBalances[2].add(pendingWeiUpdates[0]).add(pendingWeiUpdates[2]) >=
            weiBalances[0].add(weiBalances[1]).add(pendingWeiUpdates[1]).add(pendingWeiUpdates[3]), "insufficient wei");

    // token is conserved - the current total channel token + both deposits > final balances + both withdrawals
    require(channel.tokenBalances[2].add(pendingTokenUpdates[0]).add(pendingTokenUpdates[2]) >=
```
## _applyPendingUpdates

Internal function that merges any unmerged updates (i.e. deposits) into the proposed balance and updates the onchain balances.

1. If the deposit is greater than the withdrawal, adds the net of deposit minus withdrawal to the balances. (Assumes the net has *not yet* been added to the balances.
2. Otherwise, if the deposit is less than or equal to the withdrawal, leaves balances as is. (Assumes the net has *already* been added to the balances.

More info: [https://github.com/ConnextProject/contracts/blob/master/docs/aggregateUpdates.md](https://github.com/ConnextProject/contracts/blob/master/docs/aggregateUpdates.md)
```
function _applyPendingUpdates(
    uint256[3] storage channelBalances,
    uint256[2] balances,
    uint256[4] pendingUpdates
) internal {
    // update hub balance
    // If the deposit is greater than the withdrawal, add the net of deposit minus withdrawal to the balances.
    // Assumes the net has *not yet* been added to the balances.
    if (pendingUpdates[0] > pendingUpdates[1]) {
        channelBalances[0] = balances[0].add(pendingUpdates[0].sub(pendingUpdates[1]));
    // Otherwise, if the deposit is less than or equal to the withdrawal,
    // Assumes the net has *already* been added to the balances.
    } else {
        channelBalances[0] = balances[0];
    }

    // update user balance
    // If the deposit is greater than the withdrawal, add the net of deposit minus withdrawal to the balances.
    // Assumes the net has *not yet* been added to the balances.
    if (pendingUpdates[2] > pendingUpdates[3]) {
        channelBalances[1] = balances[1].add(pendingUpdates[2].sub(pendingUpdates[3]));

    // Otherwise, if the deposit is less than or equal to the withdrawal,
    // Assumes the net has *already* been added to the balances.
    } else {
        channelBalances[1] = balances[1];
    }
}
```
## _revertPendingUpdates

Internal function that does the exact opposite of `_applyPendingUpdates` to revert a withdrawal that was already introduced to balances on state submission.
```
function _revertPendingUpdates(
    uint256[3] storage channelBalances,
    uint256[2] balances,
    uint256[4] pendingUpdates
) internal {
    // If the pending update has NOT been executed AND deposits > withdrawals, offchain state was NOT updated with delta, and is thus correct
    if (pendingUpdates[0] > pendingUpdates[1]) {
        channelBalances[0] = balances[0];

    // If the pending update has NOT been executed AND deposits < withdrawals, offchain state should have been updated with delta, and must be reverted
    } else {
        channelBalances[0] = balances[0].add(pendingUpdates[1].sub(pendingUpdates[0])); // <- add withdrawal, sub deposit (opposite order as _applyPendingUpdates)
    }

    // If the pending update has NOT been executed AND deposits > withdrawals, offchain state was NOT updated with delta, and is thus correct
    if (pendingUpdates[2] > pendingUpdates[3]) {
        channelBalances[1] = balances[1];

    // If the pending update has NOT been executed AND deposits > withdrawals, offchain state should have been updated with delta, and must be reverted
    } else {
        channelBalances[1] = balances[1].add(pendingUpdates[3].sub(pendingUpdates[2])); // <- add withdrawal, sub deposit (opposite order as _applyPendingUpdates)
    }
}
```
## _updateChannelBalances

Internal function that applies pending updates and updates the onchain balance for the channel and for the `totalChannelWei`/ `totalChannelToken`.
```
function _updateChannelBalances(
    Channel storage channel,
    uint256[2] weiBalances,
    uint256[2] tokenBalances,
    uint256[4] pendingWeiUpdates,
    uint256[4] pendingTokenUpdates
) internal {
    _applyPendingUpdates(channel.weiBalances, weiBalances, pendingWeiUpdates);
    _applyPendingUpdates(channel.tokenBalances, tokenBalances, pendingTokenUpdates);

    totalChannelWei = totalChannelWei.add(pendingWeiUpdates[0]).add(pendingWeiUpdates[2]).sub(pendingWeiUpdates[1]).sub(pendingWeiUpdates[3]);
    totalChannelToken = totalChannelToken.add(pendingTokenUpdates[0]).add(pendingTokenUpdates[2]).sub(pendingTokenUpdates[1]).sub(pendingTokenUpdates[3]);

    // update channel total balances
    channel.weiBalances[2] = channel.weiBalances[2].add(pendingWeiUpdates[0]).add(pendingWeiUpdates[1]).sub(pendingWeiUpdates[2]).sub(pendingWeiUpdates[3]);
    channel.tokenBalances[2] = channel.tokenBalances[2].add(pendingTokenUpdates[0]).add(pendingTokenUpdates[1]).sub(pendingTokenUpdates[2]).sub(pendingTokenUpdates[3]);
}
```
## _verifySig

Internal view function that recovers signer from the sig(s) provided and verifies. Note that, if a one or both signatures is to be not provided, the corresponding sig input param should be a blank string.
```
function _verifySig (
    address[2] user,
    uint256[2] weiBalances, // [hub, user]
    uint256[2] tokenBalances, // [hub, user]
    uint256[4] pendingWeiUpdates, // [hubDeposit, hubWithdrawal, userDeposit, userWithdrawal]
    uint256[4] pendingTokenUpdates, // [hubDeposit, hubWithdrawal, userDeposit, userWithdrawal]
    uint256[2] txCount, // [global, onchain] persisted onchain even when empty
    bytes32 threadRoot,
    uint256 threadCount,
    uint256 timeout,
    string sigHub,
    string sigUser
) internal view {
    // prepare state hash to check hub sig
    bytes32 state = keccak256(
        abi.encodePacked(
            address(this),
            user, // [user, recipient]
            weiBalances, // [hub, user]
            tokenBalances, // [hub, user]
            pendingWeiUpdates, // [hubDeposit, hubWithdrawal, userDeposit, userWithdrawal]
            pendingTokenUpdates, // [hubDeposit, hubWithdrawal, userDeposit, userWithdrawal]
            txCount, // persisted onchain even when empty
            threadRoot,
            threadCount,
            timeout
        )
    );

    if (keccak256(sigUser) != keccak256("")) {
        require(user[0] == ECTools.recoverSigner(state, sigUser));
    }

    if (keccak256(sigHub) != keccak256("")) {
        require(hub == ECTools.recoverSigner(state, sigHub));
    }
}
```
## _verifyThread

Internal view function that recovers signer from the provided sig and verifies.
```
function _verifyThread(
    address user,
    address sender,
    address receiver,
    uint256[2] weiBalances,
    uint256[2] tokenBalances,
    uint256 txCount,
    bytes proof,
    string sig,
    bytes32 threadRoot
) internal view {
    bytes32 state = keccak256(
        abi.encodePacked(
            address(this),
            user,
            sender,
            receiver,
            weiBalances, // [hub, user]
            tokenBalances, // [hub, user]
            txCount // persisted onchain even when empty
        )
    );
    require(sender == ECTools.recoverSigner(state, sig));

    if (threadRoot != bytes32(0x0)) {
        require(_isContained(state, proof, threadRoot) == true, "initial thread state is not contained in threadRoot");
    }
}
```
## _isContained

Internal, pure Merkle root inclusion check.
```
function _isContained(bytes32 _hash, bytes _proof, bytes32 _root) internal pure returns (bool) {
    bytes32 cursor = _hash;
    bytes32 proofElem;

    for (uint256 i = 64; i <= _proof.length; i += 32) {
        assembly { proofElem := mload(add(_proof, i)) }

        if (cursor < proofElem) {
            cursor = keccak256(abi.encodePacked(cursor, proofElem));
        } else {
            cursor = keccak256(abi.encodePacked(proofElem, cursor));
        }
    }

    return cursor == _root;
}
```
## Questions

## What if the hub is the user?

If the hub == user, the `hub/userAuthorizedUpdate` functions would not allow the hub to drain funds or otherwise break proper operation.

## hubAuthorizedUpdate

1. The channel would be looked up by the user, which would fetch the hub's channel with itself.
2. The call to `_verifyAuthorizedUpdate` would have `isHub = true` and would expect the hub and user balances to come from the hub's contract reserves, which would be fine.
3. The call to `_verifySig` would check the `sigUser`, which would be expected to be the hub's sig, which would be fine.
4.

## What if the sender and receiver for a thread are the same?

