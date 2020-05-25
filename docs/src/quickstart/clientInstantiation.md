# Client Instantiation

A Connext client is a non-routing implementation of the Connext protocols. You can think of it as an SPV node (whereas an indra node is a "full node"). Clients are currently entirely self reliant - they implement the protocols in their entirety, store channel state locally, and accept an ethProvider url so that they can query blockchain state without relying on the node.

To function correctly, the Connext client needs to be passed a Connext-specific signer API. These messages form the basis of security in the Connext protocol, but it is also assumed that the client itself is running within a secure environment - otherwise correct construction/validation of Connext protocol messages could be bypassed to force the signer to sign arbitrary (Connext-prefixed) messages.

For this reason, it is safest for the client to predominantly run inside wallets and pass around a `channelProvider` to dApps running in a less-secure web context. This pattern is exactly the same as how wallets handle an `ethProvider`currently. It is recommended that client implementers carefully read through all of the following sections to ensure that user funds remain secure.

## Compatibility and React Native

At the moment, the Connext client - including the core protocol execution engine - is implemented only in Typescript. Other implementations are on the roadmap (we would love your help in building them!). The remainder of these docs will assume that the client is either being implemented within a browser, in a TS/JS server-side environment, or in React Native.

An example react native implementation can be found [here](https://github.com/ConnextProject/ConnextReactNative).

An example REST API implementation can be found [here](https://github.com/ConnextProject/rest-api-client)

## Client Options

Instantiating the client requires providing the following:

```typescript
ClientOptions = {
  ethProviderUrl: string;
  nodeUrl?: string; // node's HTTP endpoint
  signer?: string | IChannelSigner;
  store?: IStoreService;
  storeType?: StoreTypes;
  backupService?: IBackupService;
  channelProvider?: IChannelProvider;
  loggerService?: ILoggerService;
  logLevel?: number;
}
```

We'll go through each of these options below.

## Installing the Client for React Native

To integrate the Connext client in your React Native app, you must have installed react-native-crypto and polyfill NodeJS modules using rn-nodeify. You can find more information on [NPM](https://www.npmjs.com/package/react-native-crypto) but here is how to install it.

```sh
// First install dependencies
npm install --save react-native-crypto react-native-randombytes

// Link native bindings
react-native link react-native-randombytes

// install latest rn-nodeify
npm install --save-dev tradle/rn-nodeify

// run this command as postinstall
./node_modules/.bin/rn-nodeify --hack --install

// import the generated shim into index.js (or index.ios.js or index.android.js)
// make sure you use `import` and not require! 
import './shim.js' // 
```

Now you can install the Connext client from NPM:

```sh
npm install --save @connext/client
```

Then include the fixes from our example [ConnextReactNative app postinstall script](https://github.com/ConnextProject/ConnextReactNative/blob/master/ops/post-install.sh) which we recommend saving in the following path in your project: `./ops/post-install.sh`. We have also included the rn-nodeify command from the previous step.

Add the postinstall script to your project's package.json as follows:

```json
{
  "scripts": {
    "postinstall": "bash ops/post-install.sh",
  },
}
```

## Connecting to the Blockchain and to a Connext Node
Clients are unopinionated to however you choose to implement nodes for both Connext and the base chain. They simply expect to be able to connect to Ethereum (or any EVM chain) using some URL, and the Connext node over http.

For `ethProviderUrl`, this means you can use either an Infura or Alchemy url, or expose your own geth node.

For `nodeUrl` on testnet, you can either set up your own node or use our hosted testnet node on Rinkeby at `https://rinkeby.indra.connext.network"`. For mainnet, we recommend running your own node -- reach out to us directly about this on [our discord](https://discord.gg/VPVVFMd).

## Creating and Passing in a ChannelSigner
The Connext client must be instantiated with a signer API that uses a Connext-specific message prefix. This can be done unsafely by passing in a private key directly (the client will create an internal `ChannelSigner`) or by letting the client generate it's own private key like we do in [QuickStart](https://docs.connext.network/en/latest/user/quickStart.html). For production use, however, it is recommended that implementers create and pass in their own `ChannelSigner`.

The `ChannelSigner` must conform to the `IChannelSigner` API with the following specifications:
// TODO

## Setting up a Store

All clients have to be set up with some store that holds a copy of local state. We ship the client with a bunch of prebuilt default stores designed with different environments and usecases in mind:

|     StoreType     |     Context    | 
|:------------:|:--------------:|
| LocalStorage |     Browser local storage    |
| AsyncStorage |  React Native local storage  | 
|   Postgres   | Server-side database |
|    File      |    JSON File   |
|   Memory     |    In-memory (for testing) |

You can use a default store by passing in it's `StoreType` as part of the client opts:

```javascript
import AsyncStorage from "@react-native-community/async-storage";
import { StoreTypes } from "@connext/types";
import { ConnextStore } from "@connext/store";
import * as connext from "@connext/client";

const store = new ConnextStore(StoreTypes.AsyncStorage, { storage: AsyncStorage });
const channel = await connext.connect("rinkeby", { store });
```

It is also possible to create and pass in your own store implementation so long as it's structured correctly. The [default store implementations code](https://github.com/ConnextProject/indra/tree/staging/modules/store) should give an idea of how this should look.

## Backing up State

The store module will save all the state channel state locally but it's recommended that Wallets will backup this state remotely in a secure environment so that user's could restore it easily with their mnemonic.

We provide an option to pass BackupServiceAPI which will hook up to the store module to maintain the state remotely in sync with the saved local state. The interface should match the following:

```typescript
type StorePair = {
  path: string;
  value: any;
};

interface IBackupService {
  restore(): Promise<StorePair[]>;
  backup(pair: StorePair): Promise<void>;
}
```

For more info, see [Creating a Custom Backup Service](https://docs.connext.network/en/latest/user/advanced.html#creating-a-custom-backup-service).

## ChannelProviders
A channel provider is an interface that allows an application to safely communicate with a remote Connext client over RPC. Wallets can inject a `ChannelProvider` into a browser context for web-dApps similarly to how they currently inject an existing `ethProvider` (without exposing keys or the signer to the dApp directly).

You can create a channelProvider by following along with our [example implementation](https://github.com/ConnextProject/indra/blob/staging/modules/daicard/src/utils/wc.js) using WalletConnect in the Dai Card.

## Logging
You may also provide a Logger to the client that corresponds to the `ILoggerService` interface: 

```typescript
export interface ILogger {
  debug(msg: string): void;
  info(msg: string): void;
  warn(msg: string): void;
  error(msg: string): void;
}

// Designed to give devs power over log format & context switching
export interface ILoggerService extends ILogger {
  setContext(context: string): void;
  newContext(context: string): ILoggerService;
}
```
The client accepts a `LogLevel` of 1-5 where 1 corresponds to minimal logging (only errors) and 5 corresponds to oppressive logging. Note that this interface is consistent with logging services such as Winston.
