# @connext/store

Connext Store Module

## Install

Install NPM package in your project

```bash
npm install --save @connext/store
```

## Setup

For Browsers

```javascript
import { ConnextStore } from "@connext/store";

const store = new ConnextStore(window.localStorage);
```

For React-Native

```javascript
import AsyncStorage from "@react-native-community/async-storage";
import { ConnextStore } from "@connext/store";

const store = new ConnextStore(AsyncStorage);
```

## Advanced Options

```javascript
import AsyncStorage from "@react-native-community/async-storage";
import { ConnextStore } from "@connext/store";
import PisaClient from "pisa-client";
import ethers from "ethers";

const store = new ConnextStore(
  window.localStorage || AsyncStorage, // REQUIRED
  {
    prefix: "CONNEXT_STORE",
    separator: "/",
    pisaClient: new PisaClient(pisaUrl, contractAddress),
    wallet: new ethers.Wallet(privateKey),
  },
);
```
