# @connext/watcher

Module responsible for initiating, responding to, and monitoring challenges.

## Usage

### Watchtower

```typescript
import { addressBook } from "@connext/contracts";
import { getMemoryStore } from "@connext/store";
import { Watcher } from "@connext/watcher";

import { Wallet, providers } from "ethers";

// Set up eth variables
const provider = new providers.JsonRpcProvider("http://localhost:8545");
const account = await provider.getAccounts();

// Set up contract addresses from address-book
let context = {};
Object.entries(addressBook[1337]).map(([key, value]) => {
  context[key] = value.address;
});

// Start watcher
const watcher = await Watcher.init({
  store: getMemoryStore(),
  signer: accounts[0].privateKey,
  provider,
  context,
});

// Enable the watcher
await watcher.enable();

// Begin a channel challenge
const appId = hexlify(randomBytes(32)); // get from channel participant you are watching for
await watcher.initiate(appId);
```

### From node

TODO

### From client

TODO

### Considerations

#### Availability

Challenges are based on advancing state onchain within a certain time period. Once both players allow the challenge timer to elapse, whatever state is onchain will be used to settle the funds out of the multsig. Depending on the logic of your channel application, there may be cases where if users go offline during the challenge process they could lose funds (since they did not settle with the latest state). This is important to consider when deciding between watchtowers and native client/node challenge resolution.

#### Cost

Challenges can be costly to run, and disputing a single application currently involves up to 6 onchain transactions. It is likely that many channel participants (specifically clients) will not want to pay for the challenge gas costs. Additionally, all watcher-signers must have ETH in their wallet to be able to send transactions.

## Reference

**Exported Classes:**

- [`Watcher`](#watcher)
- [`ChainListener`](#chainlistener)

### Watcher

Initiates, responds to, and manages challenges on behalf of channel users.

```typescript
class Watcher {
  //////// Public methods
  static init(opts: WatcherInitOptions): Promise<Watcher>;
  enable(): Promise<void>;
  disable(): Promise<void>;
  initiate(appIdentityHash: string): Promise<ChallengeInitiatedResponse>;
  cancel(
    appIdentityHash: string,
    req: SignedCancelChallengeRequest,
  ): Promise<providers.TransactionReceipt>;

  //////// Listener methods
  emit<T extends WatcherEvent>(event: T, data: WatcherEventData[T]): void;
  on<T extends WatcherEvent>(
    event: T,
    callback: (data: WatcherEventData[T]) => Promise<void>,
    filter?: (payload: WatcherEventData[T]) => boolean,
  ): void;
  once<T extends WatcherEvent>(
    event: T,
    callback: (data: WatcherEventData[T]) => Promise<void>,
    filter?: (payload: WatcherEventData[T]) => boolean,
  ): void;
  waitFor<T extends WatcherEvent>(
    event: T,
    timeout: number,
    filter?: (payload: WatcherEventData[T]) => boolean,
  ): Promise<WatcherEventData[T]>;
  off(): void;
}
```

#### Instantiation

The watcher is instantiated using an asynchronous `init` method:

```typescript
type WatcherInitOptions = {
  signer: IChannelSigner | string; // wallet or pk
  provider: providers.JsonRpcProvider | string;
  context: ContractAddresses;
  store: IStoreService;
  logger?: ILoggerService | ILogger;
  logLevel?: number;
};

static init(opts: WatcherInitOptions): Promise<Watcher>
```

The options object contains the following fields:

- `signer`:
  `IChannelSigner` or private key string, for sending transactions to chain (corresponding account be funded with ETH for gas)

- `provider`:
  An ethers `JsonRpcProvider` or eth provider url, this will be shared with an internal instance of the ChainListener class.

- `context`:
  A json containing all the addresses across the relevant network (should be derived from your `address-book.json`). This will be shared with an internal instance of the ChainListener class.

- `store`:
  `IStoreService` is an interface containing all the store methods for saving challenge records. You can use any connext store, or implement your own. See [challenge storage](#challengestorage) for more detail.

- `logger (optional)`:
  Optional logger, can use the exported logger from the `@connext/utils` package

- `logLevel (optional)`:
  Optional log level, specify 3 for info and 5 for debug.

#### Methods

##### enable

Once enabled, watchers will continuously monitor the chain and respond to challenges on behalf of channel users. Watchers will not independently initiate or cancel app challenges.

```typescript
enable(): Promise<void>
```

##### disable

If disabled, watchers will no longer respond to challenges automatically.

```typescript
disable(): Promise<void>
```

##### initiate

Begins a channel challenge with the latest app state found in the store. Will challenge the application associated with the provided identifier, as well as the free balance application of the channel. Once a channel is in challenge, it should not be used again unless the challenge is successfully cancelled.

```typescript
initiate(appIdentityHash: string): Promise<ChallengeInitiatedResponse>
```

##### cancel

Cancels an existing and onchain challenges in the `IN_ONCHAIN_PROGRESSION` phase. Will not work for challenges once their outcomes have been set.

```typescript
type SignedCancelChallengeRequest = {
  versionNumber: BigNumber;
  signatures: string[];
};

cancel(appIdentityHash: string, req: SignedCancelChallengeRequest): Promise<providers.TransactionReceipt>
```

#### Events

The Watcher emits the following events, with the `*Failed` event payloads having the `TransactionFailedEvent` payload outlined [below](#transactionevents):

- `ChallengeUpdatedEvent`
- `StateProgressedEvent`
- `ChallengeProgressedEvent`
- `ChallengeProgressionFailedEvent`
- `ChallengeOutcomeFailedEvent`
- `ChallengeOutcomeSetEvent`
- `ChallengeCompletedEvent`
- `ChallengeCompletionFailedEvent`
- `ChallengeCancelledEvent`
- `ChallengeCancellationFailedEvent`

#### Adjudicator Events

##### ChallengeUpdatedEvent

Emitted by the adjudicator contract (and parroted by the watcher) when the onchain record of the challenge has been updated.

Payload:

```typescript
type ChallengeUpdatedEventPayload = {
  identityHash: Bytes32;
  status: ChallengeStatus;
  appStateHash: Bytes32; // latest app state
  versionNumber: BigNumber;
  finalizesAt: BigNumber;
};
```

##### StateProgressedEvent

Emitted by the adjudicator contracts, specifically `MixinProgressState.sol` when an onchain record action has been played on an app during the challenge process.

Payload:

```typescript
type StateProgressedEventPayload = {
  identityHash: string;
  action: string; // encoded
  versionNumber: BigNumber;
  timeout: BigNumber;
  turnTaker: Address; // eth addr
  signature: string; // of action taker
};
```

#### Transaction Events

Excluding `ChallengeUpdatedEvent` and `StateProgressedEvent`, events are emitted when a transaction either succeeds or fails, depending on which adjudicator contract function was called. See the [Background](#background) section for more information on the onchain challenge protocol.

These events take on the following structures:

```typescript
// When tx successful
type TransactionCompletedEvent = {
  transaction: providers.TransactionReceipt;
  appInstanceId: Bytes32;
  multisigAddress: Address;
};

// When tx failed
type TransactionFailedEvent = {
  appInstanceId: Bytes32;
  error: string;
  multisigAddress: Address;
  challenge: StoredAppChallenge | undefined;
  params: any; // contract method params
```

#### challenge Storage

### ChainListener

Listens to the adjudicator contracts onchain for events, and emits the properly typed versions. Makes use of the [evt](https://www.evt.land/) package for handling typed events.

```typescript
class ChainListener {
  constructor(
    provider: providers.JsonRpcProvider,
    context: ContractAddresses,
    loggerService: ILoggerService,
  ) {}

  //////// Public methods
  enable(): Promise<void>;
  disable(): Promise<void>;
  parseLogsFrom(startingBlock: number): Promise<void>;

  //////// Evt methods
  attach<T extends ChallengeEvent>(
    event: T,
    callback: (data: ChallengeEventData[T]) => Promise<void>,
    providedFilter?: (data: ChallengeEventData[T]) => boolean,
    ctx?: Ctx<ChallengeEventData[T]>,
  ): void;
  attachOnce<T extends ChallengeEvent>(
    event: T,
    callback: (data: ChallengeEventData[T]) => Promise<void>,
    providedFilter?: (data: ChallengeEventData[T]) => boolean,
    ctx?: Ctx<ChallengeEventData[T]>,
  ): void;
  waitFor<T extends ChallengeEvent>(
    event: T,
    timeout: number,
    providedFilter?: (data: ChallengeEventData[T]) => boolean,
    ctx?: Ctx<ChallengeEventData[T]>,
  ): Promise<ChallengeEventData[T]>;
  createContext<T extends ChallengeEvent>(): Ctx<ChallengeEventData[T]>;
  detach<T extends ChallengeEvent>(ctx?: Ctx<ChallengeEventData[T]>): void;
}
```

#### Instantiation

ChainListener should be instantiated with:

- `provider`:
  An ethers `JsonRpcProvider` or eth provider url

- `context`:
  A json containing all the addresses across the relevant network (should be derived from your `address-book.json`)

#### Methods

##### enable

Listener begins emitting parsed events from the challenge registry.

```typescript
enable(): Promise<void>
```

##### disable

Listener stops listening and parsing onchain events.

```typescript
disable(): Promise<void>
```

##### parseLogsFrom

Parses all events emitted from the challenge registry starting from the provided block number up to the current block.

```typescript
parseLogsFrom(startingBlock: number): Promise<void>
```
