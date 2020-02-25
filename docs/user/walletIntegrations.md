# Wallet Integrations

The Connext client assumes that it runs in a trusted environment because it needs to control the ability to automatically sign messages and transactions on behalf of a user. To ensure that user funds remain secure, it is recommended that implementers carefully read through all of the following sections:

## Client Options

Instantiating the client requires providing the following:

| Name | Type | Description | Optional |
| ------ | ------ | ------ | ------ |
| ethProviderUrl | String | the Web3 provider URL used by the client | no |
| nodeUrl | String | url of the node | yes |
| mnemonic | String | Mnemonic of signing wallet | yes |
| xpub | String | Extended Public Key of signing wallet | yes |
| keyGen | String | Key Generation callback of signing wallet | yes |
| store | Store | Module for storing local state | yes |
| logLevel | number | Depth of logging | yes |
| asyncStorage | AsyncStorage | AsyncStorage module for react-native | yes |
| backupService | IBackupServiceAPI | Backup service module to store state remotely | yes |

## Compatibility and React Native

At the moment, the Connext client - including the core protocol execution engine - is implemented only in Typescript. Other implementations are on the roadmap (we would love your help in building them!). The remainder of these docs will assume that the client is either being implemented in a TS/JS server-side environment or in React Native.

## Pre-requirements

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

## Installing

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

## Setting up a Channel

Finally you can import the Connext client inside your app and connect a channel using the same quick start instructions but also including the AsyncStorage package as an option for storing state locally in React Native.

```javascript
import AsyncStorage from "@react-native-community/async-storage";
import * as connext from "@connext/client"

const channel = await connext.connect("rinkeby", { asyncStorage: AsyncStorage })
```


## Managing Mnemonics and the KeyGen Function

Connext is opinionated in that all channels are associated with a BIP32 mnemonic, xpriv, or HDWallet rather than a simple private key. This is done as part of the core protocols in order to protect against replay attacks on the channel's state. When making updates to the state, the protocol generates a new ephemeral key for each interaction, where the generated key is the `nth` key along a custom state-channel-specific path.

`const CF_PATH = "m/44'/60'/0'/25446";`

This has a couple of consequences:

First, wallets will need to create and safely store a mnemonic, xpriv, or HDWallet for the user - even if they are building on contract wallet infrastructure that uses randomized keys. The mnemonic itself can be completely channel-specific and, because channels can be disputed if the mnemonic is lost, should still be able to conform to existing contract wallet recovery patterns.

Second, wallets should consider how they wish to expose the client to the mnemonic. For simplicity, it is possible to pass in the mnemonic directly into the client. However, this is an **unsafe** pattern and should not be used in production, particularly if the user's funds are also tied to the same mnemonic. 

Ideally, the master key is hosted outside of the client. The wallet can then derive the `xpub` associated with the mnemonic,
```javascript
const hdWallet = fromExtendedKey(fromMnemonic(mnemonic).extendedKey).derivePath(CF_PATH);
const xpub = hdNode.neuter().extendedKey;
```
And then pass it in along with a wrapper function to derive ephemeral keys as needed:
```javascript
  keyGen: function(index) => {
    return Promise.resolve(hdNode.derivePath(index).privateKey);
  }
```

## Backing up State

The store module will save all the state channel state locally but it's recommended that Wallets will backup this state remotely in a secure environment so that user's could restore it easily with their mnemonic.

We provide an option to pass BackupServiceAPI which will hook up to the store module to maintain the state remotely in sync with the saved local state. The interface should match the following:

```typescript
type StorePair = {
  path: string;
  value: any;
};

interface IBackupServiceAPI {
  restore(): Promise<StorePair[]>;
  backup(pair: StorePair): Promise<void>;
}
```

