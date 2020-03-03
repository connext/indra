# Quick Start

Like [web3.js](https://web3js.readthedocs.io/), the Connext client is a collection of libraries that allow you to interact with a local or remote Connext node.

This quickstart will guide you through instantiating the Connext client with a mnemonic in a web environment to get basic Connext functionality (deposits, swaps, transfers, withdrawals) working as fast as possible. 

Instantiating with a mnemonic _should not_ be used in production environments - once you get through this guide, we recommend looking through the Dapp Integration or [Wallet Integrations](../userDocumentation/walletIntegrations) guides for better patterns.

We will connect to the Rinkeby node hosted at `https://rinkeby.indra.connext.network/api/messaging` using the Connext client. If you don't have any Rinkeby ETH, we recommend you get some from a [faucet](https://faucet.rinkeby.io/) before continuing with this guide.

## Setting up a Channel

First install the client library in your project root directory using  NPM or Yarn:

```sh
npm install --save @connext/client

# OR

yarn add @connext/client
```


Then import it and setup a channel by calling `connext.connect()`

```javascript
import * as connext from "@connext/client";

const channel = await connext.connect("rinkeby")
```

If you're using React, it can be helpful to set up your channel and save the instance to state in `componentDidMount` (or even better, in a [React hook](https://reactjs.org/docs/hooks-intro.html)).

## Depositing

After instantiating and starting Connext, you can deposit into a channel with `channel.deposit`. Our hosted node accepts deposits in ETH and all ERC20 tokens. However, when depositing tokens, ensure the user has sufficient ETH remaining in their wallet to afford the gas of the deposit transaction. The address which the client uses to send funds to the channel can be found by calling `await channel.signerAddress()`.

```javascript
// Making a deposit in ETH
import { AddressZero } from "ethers/constants";
import { parseEther } from "ethers/utils";

const payload: AssetAmount = {
  amount: parseEther("0.1").toString(), // in wei/wad (ethers.js methods are very convenient for getting wei amounts)
  assetId: AddressZero // Use the AddressZero constant from ethers.js to represent ETH, or enter the token address
};

channel.deposit(payload);
```

## Swaps

Our hosted node collateralizes ETH and Dai and allows you to swap between them in-channel. Say hello to instant and free exchanges. Exchange rates are pulled from the [Dai medianizer](https://developer.makerdao.com/feeds/).

Make an in-channel swap:

```javascript
// Exchanging Wei for Dai
import { AddressZero } from "ethers/constants";
import { parseEther } from "ethers/utils";

const payload: SwapParams = {
  amount: parseEther("0.1").toString() // in wei (ethers.js methods are very convenient for getting wei amounts)
  toAssetId: "0x89d24a6b4ccb1b6faa2625fe562bdd9a23260359" // Dai
  fromAssetId: AddressZero // ETH
}

await channel.swap(payload)
```

## Making a Transfer

Making a transfer is simple! Just call `channel.transfer()`. Recipient is identified by the counterparty's xPub identifier, which you can find with `channel.publicIdentifier`.

```javascript
// Transferring ETH
import { AddressZero } from "ethers/constants";
import { parseEther } from "ethers/utils";

const payload: TransferParams = {
  recipient: "xpub1abcdef", //counterparty's xPub
  meta: { value: "Metadata for transfer" }, // any arbitrary JSON data, or omit
  amount: parseEther("0.1").toString(), // in wei (ethers.js methods are very convenient for getting wei amounts)
  assetId: AddressZero // ETH
};

await channel.transfer(payload);
```

## Withdrawing

Users can withdraw funds to any recipient address with `channel.withdraw()`. The specified `assetId` and `amount` must be part of the channel's free balance.

```javascript
// Withdrawing ETH
import { AddressZero } from "ethers/constants";
import { parseEther } from "ethers/utils";

const payload: WithdrawParams = {
  recipient: // defaults to signer xpub but can be changed to withdraw to any recipient
  amount: parseEther("0.1").toString() // in wei (ethers.js methods are very convenient for getting wei amounts)
  assetId: AddressZero
}

await channel.withdraw(payload)
```

## React Native

If you are interested in using Connext in react native, check out a sample implementation [here](https://github.com/ConnextProject/ConnextReactNative) based on the react native typescript template.

## What's next?

If you're integrating Connext into a wallet, check out [Wallet Integrations](../userDocumentation/walletIntegrations).

If you're building an application that uses Connext, check out DApp Integrations (docs coming soon!).

## Additional Resources

Further documentation on the client (types, method reference, etc) can be found [here](../userDocumentation/clientAPI).

A live mainnet implementation can be found [here](../userDocumentation/daiCard).
