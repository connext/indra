# @connext/store

**Exported Types:**

- [`IAsyncStorage`](#iasyncstorage)
- [`IBackupService`](#ibackupservice)
- [`IStoreService`](#istoreservice)

**Exported Functions:**

- [`getAsyncStore`](#getasyncstore)
- [`getFileStore`](#getfilestore)
- [`getLocalStore`](#getlocalstore)
- [`getMemoryStore`](#getmemorystore)
- [`getPostgresStore`](#getpostgresstore)

## Types

### IAsyncStorage

The interface for React Native's AsyncStorage. For example, what you get from importing `@react-native-community/async-storage`.

```
interface IAsyncStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}
```

### IBackupService

The interface implemented by backup services such as Pisa which provide a remote location for storing channel commitments (required for on-chain disputes). If an `IBackupService` is given to a store then it will send all generated commitments to that service for safe keeping or to enable it to act as a watchtower on your behalf.

```
interface IBackupService {
  restore(): Promise<Array<{ path: string, value: any }>>;
  backup(pair: { path: string, value: any }): Promise<void>;
}
```

### IStoreService

The interface containing all the read/write methods that the core protocol needs to interact with your off-chain state. It's relatively complicated, you can see the type definition at `indra/modules/types/src/store.ts` but you shouldn't ever need to deal w this type directly, that's what the functions exported by this lib are for. 😉

## Functions

### getAsyncStore

```
getAsyncStore(storage: IAsyncStorage, backupService?: IBackupService): IStoreService;
```

#### Params

1. `storage:`: [`IAsyncStorage`](#iasyncstorage)
2. `backupService`: [`IBackupService`](#ibackupservice) (optional)

#### Returns

An [`IStoreService`](#istoreservice) configured to save data in React Native's Async Storage.

### getFileStore

```
getFileStore(fileDir: string, backupService?: IBackupService): IStoreService;
```

#### Params

1. `fileDir:`: `string` (optional) The path to a folder where the files containing store data will be saved. Defaults to `./.connext-store`;
2. `backupService`: [`IBackupService`](#ibackupservice) (optional)

#### Returns

An [`IStoreService`](#istoreservice) configured to save data to a collection of files in `fileDir`.

### getLocalStore

```
getLocalStore(backupService?: IBackupService): IStoreService;
```

#### Params

1. `backupService`: [`IBackupService`](#ibackupservice) (optional)

#### Returns

An [`IStoreService`](#istoreservice) configured to save data to a browser's `localStorage`.

### getMemoryStore

```
getMemoryStore(backupService?: IBackupService): IStoreService;
```

#### Params

1. `backupService`: [`IBackupService`](#ibackupservice) (optional)

#### Returns

Returns an [`IStoreService`](#istoreservice) configured to not save data & keep everything in memory. Good for testing, not good for managing real channel data.

### getPostgresStore

```
getPostgresgStore(connectionUri: string, backupService?: IBackupService): IStoreService;
```

#### Params

1. `connectionUri:`: `string` Should look something like `postgres://user:password@host:port/database`.
2. `backupService`: [`IBackupService`](#ibackupservice) (optional)

#### Returns

Returns an [`IStoreService`](#istoreservice) configured to save data to a postgres database.
