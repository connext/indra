## Store Module

Channels move state storage completely offchain to the end user's device. This means that the security of a user's state is tied to a user's funds. We recommend to use our helper store module to manage the state channel store, which is compatible with both browser and react-native environments.

First you need to install from NPM
```bash
npm install --save @connext/store
```

Secondly you can setup the store module

*for browsers*

```javascript
import { ConnextStore } from "@connext/store";

const store = new ConnextStore(window.localStorage);
```

*for react-native*

```javascript
import AsyncStorage from "@react-native-community/async-storage";
import { ConnextStore } from "@connext/store";

const store = new ConnextStore(AsyncStorage);
```

Finally you can pass the store to the client as an option

```javascript
import * as connext from "@connext/client";


const channel = await connext.connect({
  ...otherOptions,
  store
})
```

The store module allows to customize advanced options to backup the state using a Pisa server 

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



