
# @connext/store

**Exports:**
 - [`PisaBackupService`](#pisabackupservice)
 - [`getAsyncStore`](#getasyncstore)
 - [`getFileStore`](#getFileStore)
 - [`getLocalStore`](#getLocalStore)
 - [`getMemoryStore`](#getMemoryStore)
 - [`getPostgresStore`](#getPostgresStore)

## Types

### `IAsyncStorage`

A React Native app's AsyncStorage. For example, what you get from importing `@react-native-community/async-storage`.

```
interface IAsyncStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}
```

### `IBackupService`

The interface implemented by backup services such as Pisa which provide a remote location for storing channel commitments (required for on-chain disputes). If an `IBackupService` is given to a store then it will send all generated commitments to that service for safe keeping or to enable it to act as a watchtower on your behalf.

```
interface IBackupService {
  restore(): Promise<Array<{ path: string, value: any }>>;
  backup(pair: { path: string, value: any }): Promise<void>;
}
```

### `IStoreService`

Contains all the read/write methods that the core protocol needs to interact with your off-chain state. It's relatively complicated, you can see the type definition at `indra/modules/types/src/store.ts` but you shouldn't ever need to deal w this type directly, that's what the methods exported by this lib are for. :wink:

## Classes

### `PisaBackupService`

An `IBackupService` configured to work with Pisa's state backup service.

```
class PisaBackupService implements IBackupService {
  constructor(pisaClient: string, wallet: Wallet)
}
```

### Constructor Params
1. `pisaUrl`: The URL that points to our Pisa backup service endpoint.
2. `wallet`: an ethers `Wallet`, used to authenticate with Pisa.

### `getAsyncStore`

```
getAsyncStore(storage: IAsyncStorage, backupService?: IBackupService): IStoreService;
```

Returns an `IStoreService` configured to save data in React Native's Async Storage.

#### Params

1. `storage:`: [`IAsyncStorage`](#iasyncstorage)
2. `backupService`: [`IBackupService`](#ibackupservice) (optional)

#### Returns

[`IStoreService`](#istoreservice)

### `getFileStore`

```
getFileStore(fileDir: string, backupService?: IBackupService): IStoreService;
```

Returns an `IStoreService` configured to save data to a collection of files in `fileDir`.

#### Params

1. `fileDir:`: `string` (optional) The path to a folder where the files containing store data will be saved. Defaults to `./.connext-store`;
2. `backupService`: [`IBackupService`](#ibackupservice) (optional)

#### Returns

[`IStoreService`](#istoreservice)

### `getLocalStore`

```
getLocalStore(backupService?: IBackupService): IStoreService;
```

Returns an `IStoreService` configured to save data to a browser's `localStorage`.

#### Params

1. `backupService`: [`IBackupService`](#ibackupservice) (optional)

#### Returns

[`IStoreService`](#istoreservice)

### `getMemoryStore`

```
getMemoryStore(backupService?: IBackupService): IStoreService;
```

Returns an `IStoreService` configured to not save data & keep everything in memory. Good for testing, not good for managing real channel data.

#### Params

1. `backupService`: [`IBackupService`](#ibackupservice) (optional)

#### Returns

[`IStoreService`](#istoreservice)

### `getPostgresStore`

```
getPostgresgStore(connectionUri: string, backupService?: IBackupService): IStoreService;
```

Returns an `IStoreService` configured to save data to a postgres database.

#### Params

1. `connectionUri:`: `string` Should look something like `postgres://user:password@host:port/database`.
2. `backupService`: [`IBackupService`](#ibackupservice) (optional)

#### Returns

[`IStoreService`](#istoreservice)
