# The Basics of using a Connext Client

Like [web3.js](https://web3js.readthedocs.io/) or [ethers](https://docs.ethers.io), the Connext client is a collection of libraries that allow you to interact with a local or remote Connext node.

This quickstart will guide you through instantiating the Connext client with a randomly generated private key in a web environment to get basic Connext functionality (deposits, swaps, transfers, withdrawals) working as quickly as possible.

Instantiating with a private key _should not_ be used in production environments - once you get through this guide, we recommend looking through the [React Native Integration](../how-to/integrate-react-native) guide for better patterns.

We will connect to a testnet (Rinkeby) node hosted at `https://rinkeby.indra.connext.network/api/messaging` using the Connext client. If you don't have any Rinkeby ETH, we recommend you get some from a [faucet](https://faucet.rinkeby.io/) before continuing with this guide.

## Setting up a Channel

First install the client library in your project root directory using NPM or Yarn:

```sh
npm install --save @connext/client

# OR

yarn add @connext/client
```

Then import it and setup a channel by calling `connext.connect()`

```javascript
import * as connext from "@connext/client";

const channel = await connext.connect("rinkeby");
```

This will create a channel for you using a private key randomly generated from inside the client.

If you're using React, it can be helpful to set up your channel and save the instance to state in `componentDidMount` (or even better, in a [React hook](https://reactjs.org/docs/hooks-intro.html)).

## Depositing

After instantiating and starting Connext, you can deposit into a channel with `channel.deposit` with any Eth or ERC20 token. The default `.deposit` method will attempt to deposit value from the channel's signer address, found using `await channel.signerAddress()`. Because of this, if you're trying to deposit a token, ensure that the user has sufficient Eth in their signer address to pay gas for the deposit transaction.

```javascript
// Making a deposit in ETH
import { constants, utils } from "ethers";

const payload: AssetAmount = {
  amount: utils.parseEther("0.1").toString(), // in wei/wad
  assetId: constants.AddressZero, // Use constants.AddressZero to represent ETH or enter the token address
};

channel.deposit(payload);
```

You can also deposit directly into the channel by bypassing the signer address with some additional work. For more info, see [Controlling Deposit Flow](https://docs.connext.network/en/latest/user/advanced.html#controlling-deposit-flow)

## Swaps

Our hosted testnet node collateralizes test ETH and test Dai and allows you to swap between them in-channel. Say hello to instant and free exchanges. Exchange rates are pulled from the [Dai medianizer](https://developer.makerdao.com/feeds/).

Make an in-channel swap:

```javascript
// Exchanging Wei for Dai
import { constants, utils } from  "ethers"

const payload: SwapParams = {
  amount: utils.parseEther("0.1").toString() // in wei/wad
  toAssetId: "0x89d24a6b4ccb1b6faa2625fe562bdd9a23260359" // Dai
  fromAssetId: constants.AddressZero // ETH
}

await channel.swap(payload)
```

## Making a Transfer

You can now instantly make a transfer to any other client connected to the testnet node. Making a transfer is simple! Just call `channel.transfer()`. Recipient is identified by the counterparty's public identifier, which you can find with `channel.publicIdentifier`.

```javascript
// Transferring ETH
import { constants, utils } from "ethers";

const payload: TransferParams = {
  recipient: "indraZTSVFe...", // counterparty's public identifier
  meta: { value: "Metadata for transfer" }, // any arbitrary JSON data, or omit
  amount: utils.parseEther("0.1").toString(), // in wei/wad
  assetId: constants.AddressZero, // ETH
};

await channel.transfer(payload);
```

## Withdrawing

Users can withdraw funds to any recipient address with `channel.withdraw()`. The specified `assetId` and `amount` must be part of the channel's balance.

```javascript
// Withdrawing ETH
import { constants, utils } from  "ethers"

const payload: WithdrawParams = {
  recipient: // defaults to signer address but can be changed to withdraw to any recipient
  amount: utils.parseEther("0.1").toString() // in wei/wad
  assetId: constants.AddressZero
}

await channel.withdraw(payload)
```

## React Native

If you are interested in using Connext in react native, check out a sample implementation [here](https://github.com/ConnextProject/ConnextReactNative) based on the react native typescript template.

## What's next?

If you're integrating Connext into a native wallet, check out the [React Native Integration Guide](../how-to/integrate-react-native.md).

If you're building an application that uses Connext, check out DApp Integrations (docs coming soon!).

## Additional Resources

Further documentation on the client (types, method reference, etc) can be found [here](../reference/client).

A live mainnet implementation can be found [here](https://daicard.io).
