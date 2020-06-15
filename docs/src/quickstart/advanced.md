# Advanced

## Monitoring Your Channel

### Accessing Channel State

Information about channel state can be accessed with `getChannel()`. This includes current node and client balances, availability of channel, and more.

#### Usage Example

Information about channel state retrieved with `getChannel()` can be used (for example) to stop execution if certain conditions are not met:

```javascript
var channelAvailable = (await channel.getChannel()).available;
if (!channelAvailable) {
  console.warn(`Channel not available yet.`);
  return;
}
```

### Event Monitoring

The Connext client is an event emitter. You can trigger actions such as transfer confirmations in your application by listening for events using `connext.on()`. `connext.on()` accepts a string representing the event you'd like to listen for, as well as a callback. The callback has a single parameter `data` which contains contextual data from the event. Available events are:

Channel Events:

```javascript
CREATE_CHANNEL,
DEPOSIT_CONFIRMED,
DEPOSIT_FAILED,
DEPOSIT_STARTED,
WITHDRAWAL_CONFIRMED,
WITHDRAWAL_FAILED,
WITHDRAWAL_STARTED,
```

App Instance Events:

```javascript
INSTALL,
INSTALL_VIRTUAL,
REJECT_INSTALL,
UNINSTALL,
UNINSTALL_VIRTUAL,
UPDATE_STATE,
PROPOSE_INSTALL,
REJECT_INSTALL_VIRTUAL,
```

Protocol Events:

```javascript
PROTOCOL_MESSAGE_EVENT,
```

Transfer Events:

```javascript
RECEIVE_TRANSFER_FAILED_EVENT, RECEIVE_TRANSFER_FINISHED_EVENT, RECEIVE_TRANSFER_STARTED_EVENT;
```

Events exist in the types package as well, example:

```typescript
import { ConnextEvents, DEPOSIT_STARTED_EVENT } from "@connext/types";

connext.on(DEPOSIT_STARTED_EVENT, (data) => {
  console.log("Your deposit has begun");
  const { txHash, value } = data;
  showDepositStarted(value);
  showTxStatus(txHash);
});
```

## Controlling Deposit Flow

In some cases, an application will want to control exactly how funds are transferred to the multisig in order to add balance to a channel. The Connext client provides two methods for this, `requestDepositRights` and `rescindDepositRights`. When a client controls deposit rights in their channel, they can deposit into the multisig from any source.

An example use case is requesting deposit rights, then sending funds to a user to onboard them without requiring them to purchase ETH for gas.

## Creating a Custom Backup Service

Backup services store channel states on behalf of the client in case their store compromised or otherwise unavailable (i.e. for clearing `localStorage` in a browser, using incognito mode, or seamless multidevice channel usage). If a backup service is not available, the client will still function properly in these scenarios, but will rely on a trusted restore from the node’s version of the channel state.

### Interface

All custom backup services must implement the following interface:

```typescript
export type StorePair = {
  path: string;
  value: any;
};

export interface IBackupService {
  restore(): Promise<StorePair[]>;
  backup(pair: StorePair): Promise<void>;
}
```

The `restore` method will return an array of existing `StorePair` objects that should be used to populate the clients store using the `set` function. This function is called on `connect` if a problem with the store is detected on startup. Client users can also manually restore the state from back-up by calling `await client.restoreState()`.

The `backup` method is called when `set` is called from the `connextStore`, here. If you are using a custom store module instead of the `@connext/store` package, you will want to make sure your `set` function includes [similar logic](https://github.com/ConnextProject/indra/blob/c06f10d0a4ebad4d3fdf0a8302eb35aea4c6b0c2/modules/store/src/connextStore.ts#L48-L56) for backing up pairs. By default, only updates to the main `channel/` key will be automatically backed up.

### Example Usage

To use a backup service with the client, simply instantiate the client with the backupService key populated:

```typescript
/**
 * Imagine that there is an REST API available at some URL that has two endpoints, a
 * GET endpoint `restore` and a POST endpoint for `backup`.
 *
 * NOTE: This code has not been tested, and is designed to be purely illustrative.
 */

import { connect } from "@connext/client";
import { ClientOptions, IBackupService, StorePair } from "@connext/types";
import * as axios from "axios";

class BackupService implements IBackupService {
  private client: any;
  constructor(private readonly baseUrl: string) {
    this.client = axios.create({
      baseURL,
      responseType: "json",
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  restore = async (): Promise<StorePair[]> => {
    const res = await this.client.get("/restore");
    return res.data;
  };

  backup = async (pair: StorePair): Promise<void> => {
    await this.client.post("/backup", { pair });
  };
}

const connectOptions: ClientOptions = {
  backupService: new BackupService("https://myawesomebackup.com"),
  ethProviderUrl: "https://rinkeby.indra.connext.network/api/ethprovider",
  nodeUrl: "https://rinkeby.indra.connext.network/api/messaging",
  mnemonic: "candy maple cake sugar pudding cream honey rich smooth crumble sweet treat",
};

const client = await connect(connectOptions);
```
