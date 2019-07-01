# Card

A simple offchain wallet, hosted in the browser, which utilizes Indra payment channels. Inspired by the SpankCard and Austin Griffith's burner wallet.

See it live at: https://daicard.io

## Contents
- [Overview](#overview)
    - [Local Development](#local-development)
    - [Developing Client Alongside](#developing-connext-client-alongside)
- [Integrating into your App](#integrating-into-your-app)
    - [NPM Package](#npm-package)
    - [Autosigner vs. Metamask](#autosigner-vs-metamask)
    - [Instantiating the Connext Client](#instantiating-the-connext-client)
    - [Making Deposits to Channels](#making-deposits-to-channels)
    - [Making ETH <-> Token Swaps](#making-eth-to-token-swaps)
    - [Making Payments](#making-payments)
    - [Withdrawals](#withdrawals)
    - [Collateralization](#collateralization)

## Overview

### Local development

Prerequisites
 - Node 9+
 - Docker
 - Make

1. Make sure you have indra running locally. Check out the instructions in the [indra repo](https://github.com/ConnextProject/indra).

TL;DR run:

```
git clone https://github.com/ConnextProject/indra.git
cd indra
npm start
```

2. Deploy

From the card's project root (eg `git clone https://github.com/ConnextProject/card.git && cd card`), run one of the following:

Using a containerized webpack dev server (recommended):
```
make start
```

Using a local webpack dev server:
```
npm install
npm start
```

The above step will take a while to completely finish because the webpack dev server takes a long time to wake up. Monitor it with:

```
bash ops/logs.sh server
```

3. Check it out

 - If you started with `npm start`, browse to `http://localhost:3000`
 - If you started with `make start`, browse to `http://localhost`

4. Run tests

During local development, start the test watcher with:

```
npm run start-test
```

This will start an ongoing e2e tester that will re-run any time the tests are changed. Works well with webpack dev server but you'll have to manually re-trigger the tests after changing the card's source code.

You can also run the more heavy-duty e2e tests that will be run as part of CI integration with:

```
npm run test
```

### Developing Connext Client Alongside

Assuming indra has been cloned & started in the parent directory, run the following from the card repo:

```
bash ops/link-connext.sh
```

Sometimes the connext link gets screwy, especially if you update the connext package.json. To reset the connext link to a clean slate, do:

```
bash ops/link-connext.sh reset
```

The above will create a local copy of the connext client that you can mess with. None of you changes in this local client will be reflected in indra, make sure to copy over any changes worth keeping.

## Integrating into your App

This card is a simple implementation of the Connext Client package. If you'd like to integrate p2p micropayments into your application, you have a few options:

(1) Simply embed the card in your app or link to it for payments
(2) Build a more "bespoke" integration to fit your needs

In this section, we'll describe how the Client is integrated into the card, as well as the steps that you'll need to take to build a seamless UX.

### NPM package

The Connext client is a lightweight NPM package that can be found here:

https://www.npmjs.com/package/connext

Installation:

`npm i connext`

`import { getConnextClient } from "connext/dist/Connext.js";`

### Autosigner vs Metamask

In the card, you deposit to a hot wallet that we've generated. This is because interactions with payment channels require a number of signatures and confirmations on behalf of the end user. It's very, very bad UX to make a user sign 4 messages with Metamask to complete a single payment. Our solution is to generate a hot wallet, store the private keys locally, and use a custom Web3 provider to automatically sign transactions with that wallet. We strongly recommend that you follow a similar process.

We instantiate Web3 in App.js using our [custom provider](https://github.com/ConnextProject/card/tree/master/src/utils/web3) as follows:

```
  async setWeb3(rpc) {
    let rpcUrl, hubUrl;

    // SET RPC
    switch (rpc) {
      case "LOCALHOST":
        rpcUrl = localProvider;
        hubUrl = hubUrlLocal;
        break;
      case "RINKEBY":
        rpcUrl = rinkebyProvider;
        hubUrl = hubUrlRinkeby;
        break;
      case "MAINNET":
        rpcUrl = mainnetProvider;
        hubUrl = hubUrlMainnet;
        break;
      default:
        throw new Error(`Unrecognized rpc: ${rpc}`);
    }
    console.log("Custom provider with rpc:", rpcUrl);

    // Ask permission to view accounts
    let windowId;
    if (window.ethereum) {
      window.web3 = new Web3(window.ethereum);
      windowId = await window.web3.eth.net.getId();
    }

    // Set provider options to current RPC
    const providerOpts = new ProviderOptions(store, rpcUrl).approving();

    // Create provider
    const provider = clientProvider(providerOpts);

    // Instantiate Web3 using provider
    const customWeb3 = new Web3(provider);

    // Get network ID to set guardrails
    const customId = await customWeb3.eth.net.getId();

    // NOTE: token/contract/hubWallet ddresses are set to state while initializing connext
    this.setState({ customWeb3, hubUrl });
    if (windowId && windowId !== customId) {
      alert(`Your card is set to ${JSON.stringify(rpc)}. To avoid losing funds, please make sure your metamask and card are using the same network.`);
    }
    return;
  }
  ```

### Instantiating the Connext Client

Once you've instantiated Web3 (whether through a custom provider or the Metamask injection), you need to start up the Connext Client. We do this by creating a Connext object in App.js and then passing it as a prop to any components that require it.

```
async setConnext() {
    const { address, customWeb3, hubUrl } = this.state;

    const opts = {
      web3: customWeb3,
      hubUrl, //url of hub,
      user: address
    };
    console.log("Setting up connext with opts:", opts);

    // *** Instantiate the connext client ***
    const connext = await getConnextClient(opts);
    console.log(`Successfully set up connext! Connext config:`);
    console.log(`  - tokenAddress: ${connext.opts.tokenAddress}`);
    console.log(`  - hubAddress: ${connext.opts.hubAddress}`);
    console.log(`  - contractAddress: ${connext.opts.contractAddress}`);
    console.log(`  - ethNetworkId: ${connext.opts.ethNetworkId}`);
    this.setState({
      connext,
      tokenAddress: connext.opts.tokenAddress,
      channelManagerAddress: connext.opts.contractAddress,
      hubWalletAddress: connext.opts.hubAddress,
      ethNetworkId: connext.opts.ethNetworkId
    });
  }
  ```

  Because channel state changes when users take action, you'll likely want to poll state so that your components are working with the latest channel state:

  ```
    async pollConnextState() {
    // Get connext object
    let connext = this.state.connext;

    // Register listeners
    connext.on("onStateChange", state => {
      console.log("Connext state changed:", state);
      this.setState({
        channelState: state.persistent.channel,
        connextState: state,
        runtime: state.runtime,
        exchangeRate: state.runtime.exchangeRate ? state.runtime.exchangeRate.rates.USD : 0
      });
    });

    // start polling
    await connext.start();
  }
  ```

 ### Making Deposits to Channels

 Depositing to a channel requires invoking `connext.deposit()`, referencing the Connext object that you created when you instantiated the Client. `connext.deposit()` is asynchronous, and accepts a deposit object containing strings of Wei and token values:

 ```
const params = {
  amountWei: "10"
  amountToken: "10"
};

await connext.deposit(params);
```

If you're not using an autosigner, you can simply wrap deposit in a component. If you are using an autosigner, however, we recommend that you have users deposit to the hot wallet that you generated and run a poller that periodically sweeps funds from the wallet into the channel itself (leaving enough in the hot wallet for gas). We implement this in App.js as follows, and set it to run on an interval:

```
async autoDeposit() {
    const { address, tokenContract, customWeb3, connextState, tokenAddress } = this.state;
    const balance = await customWeb3.eth.getBalance(address);
    let tokenBalance = "0";
    try {
      tokenBalance = await tokenContract.methods.balanceOf(address).call();
    } catch (e) {
      console.warn(
        `Error fetching token balance, are you sure the token address (addr: ${tokenAddress}) is correct for the selected network (id: ${await customWeb3.eth.net.getId()}))? Error: ${
          e.message
        }`
      );
    }

    if (balance !== "0" || tokenBalance !== "0") {
      if (eth.utils.bigNumberify(balance).lte(DEPOSIT_MINIMUM_WEI)) {
        // don't autodeposit anything under the threshold
        return;
      }
      // only proceed with deposit request if you can deposit
      if (!connextState || !connextState.runtime.canDeposit) {
        // console.log("Cannot deposit");
        return;
      }

      // Set deposit amounts
      const actualDeposit = {
        amountWei: eth.utils
          .bigNumberify(balance)
          .sub(DEPOSIT_MINIMUM_WEI)
          .toString(),
        amountToken: tokenBalance
      };

      // exit if no deposit
      if (actualDeposit.amountWei === "0" && actualDeposit.amountToken === "0") {
        console.log(`Actual deposit is 0, not depositing.`);
        return;
      }

      console.log(`Depositing: ${JSON.stringify(actualDeposit, null, 2)}`);

      // Make actual deposit
      let depositRes = await this.state.connext.deposit(actualDeposit);
    }
  }
  ```

### Making ETH to Token Swaps

  How and if you use the in-channel swap functionality will depend largely on your use case. If you have an ecosystem with a native token, you can use in-channel swaps to onboard new users without them buying your token a priori: just have them deposit ETH and swap it for tokens from your reserve. You can also give users the option to swap in your UI.

  Swapping assets in-channel requires invoking `connext.exchange()`, referencing the Connext object that you created when you instantiated the Client. `connext.exchange()` is asynchronous, and accepts a balance to swap and a string representing the denomination you're swapping from:

 ```
 await this.state.connext.exchange("10", "wei");
 ```

  If you'd like users to be able to interact on your token-denominated platform without ever needing to buy your token, you can automatically swap any ETH-denominated channel deposits for your token. In the card, we've done this with an ETH<->DAI swap. We wrote an autoSwap function that's very similar to the autoDeposit in the last section; it's set to run on an interval and swaps any ETH that it finds in the channel for DAI:

  ```
    async autoSwap() {
    const { channelState, connextState } = this.state;
    if (!connextState || !connextState.runtime.canExchange) {
      // console.log("Cannot exchange");
      return;
    }
    const weiBalance = eth.utils.bigNumberify(channelState.balanceWeiUser);
    const tokenBalance = eth.utils.bigNumberify(channelState.balanceTokenUser);
    if (channelState && weiBalance.gt(eth.utils.bigNumberify("0")) && tokenBalance.lte(HUB_EXCHANGE_CEILING)) {
      console.log(`Exchanging ${channelState.balanceWeiUser} wei`);
      await this.state.connext.exchange(channelState.balanceWeiUser, "wei");
    }
  }
  ```

### Making Payments

Making payments is the core functionality of Connext, and you have a great degree of flexibility in terms of implementing payments in your application.

We facilitate 3 types of payments:
1) Channel Payments

*Channel payments involve state updates between the payee and the hub.*

2) Thread Payments

*Thread payments are sent directly from payer to payee in ephemeral "virtual channels". The payer passes a state update to the payee, and the hub decomposes that update into two channel payments (one from the payer to the hub, one from the hub to the payee). The hub never takes control of user funds; rather, it updates channel states to reflect the agreed-upon balances. In the case of disputes, users can go to chain with the latest double-signed state of their thread and recover funds.*

3) Link Payments

*Link payments allow you to send payments to a user who has never opened a channel with a Connext hub.*
[[NEED TO DESCRIBE PROCESS]]


Much like the other Connext functions, you call it on the Connext object (likely passed down from App.js) and pass it parameters containing relevant Wei/Token and recipient values:

```
paymentVal: {
        meta: {
          purchaseId: "payment"
        },
        payments: [
          {
            recipient: "0x0...."
            amount: {
              amountToken: "10"
              amountWei: "0"
            },
            type: "PT_CHANNEL"
          }
        ]
      }

 await connext.buy(paymentVal);
 ```

 In the card, we've wrapped `connext.buy()` in a button; users enter an address and payment amount, the paymentVal object is updated, and the function is called onClick. However, `connext.buy()` can be implemented to fit your use case: streaming payments, for example, could run `buy` on a poller until a user stops watching a video. Alternatively, a machine could trigger a payment on receipt of data--and this is just the tip of the iceberg!

You'll notice that the paymentVal object allows for multiple payments. This is done so that, if you'd like, you can batch payments. This could be helpful if (e.g.) you're using Metamask as a signer instead of an autosigner and want to batch payments from a user; it could also help with invoicing or accounting if you're operating an ecosystem with a many-to-one payment paradigm.

### Withdrawals

`connext.withdraw()` allows you to withdraw part or all of your funds from a channel to an external address. Called on the Connext object, it accepts parameters indicating the amount to withdraw in tokens and/or Wei. It also includes a `tokensToSell` parameter that, at your/your user's discretion, will automatically swap those tokens for ETH and withdraw your balance in ETH rather than tokens. This is helpful for onboarding to/offboarding from ecosystems with a native token or a specific desired denomination.

Implementation:

```
withdrawalVal: {
        withdrawalWeiUser: "10",
        tokensToSell: "0",
        withdrawalTokenUser: "0",
        weiToSell: "0",
        recipient: "0x0..."
      }

await connext.withdraw(withdrawalVal);
```

Because the card is effectively a hot wallet, we've set our implementation of `connext.withdraw()` to withdraw all funds from the channel; however, in practice users can withdraw however much or little they'd like.


### Collateralization

`connext.requestCollateral()` is used to have the hub collateralize the payee's channel so that they can receive payments.

The hub has a minimum it will collateralize into any channel. This deposit minimum is set to 10 DAI and is enforced on every user deposit, collateral call, but NOT enforced on withdrawals.

The hub is triggered to check the collateral needs of the user after any payment is sent to them, regardless if the payment was successful. As you are implementing the client, you can use a failed payment to kickoff the autocollateral mechanism.

The autocollateral mechanism determines the amount the hub should deposit by checking all recent payments made to recipients, and deposits the 1.5 times the amount to cover the collateral. A minimum of 10 DAI and maximum of 169 DAI are enforced here to reduce collateral burden on the hub.

On cashout, you have the ability to implement "partial withdrawals", which would leave some tokens (and potentially wei) in the channel. On withdrawing, the hub will leave enough DAI in the channel to facilitate exchanges for the remaining user wei balance, up to the exchange limit of 69 DAI. This way, the hub is optimistically collateralizing for future exchanges.

Note that these collateral limitations mean that there is a hard cap to the size of payments the hub can facilitate (169 DAI). However, there is no limit to how much eth the user can store in their side of the channel. The hub will just refuse to facilitate payments or exchanges that it cannot collateralize, but the user will not have to deposit more ETH.

Right now, submitting a withdrawal request with zero value will decollateralize a user's channel entirely.

This presents a few practical challenges: hub operators must decide how to allocate their reserves to minimize (a) the number of payments that fail due to uncollateralized channels and (b) the amount of funds locked up in channels. In addition, implementers should adhere to some best practices to reduce loads on the hub and minimize the chance of payment delays. Because this is new technology, we're still exploring the best ways to handle collateralization and hub reserve management and will update this section as we learn more.
