
# @connext/store

The store module exports 5 functions:
 - [`getAsyncStore`](#geasyncstore)
 - [`getFileStore`](#getFileStore)
 - [`getLocalStore`](#getLocalStore)
 - [`getMemoryStore`](#getMemoryStore)
 - [`getPostgresStore`](#getPostgresStore)

All functions return an `IStoreService` which is what we need to pass into the client's `store` arg.

## Types

## Methods

### `getAsyncStore`

```
getAsyncStore(storage: IAsyncStorage, backupService?: BackupAPI): IStoreService;
```

#### Params

1. `storage`: This is the AsyncStorage interface, what we'd get from
2. `backupService`: [optional]

#### Returns

`IStoreService`

## `getFileStore`
## `getLocalStore`
## `getMemoryStore`
## `getPostgresStore`
