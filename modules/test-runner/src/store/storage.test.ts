import {
  storeDefaults,
  storeKeys,
} from "@connext/store";
import { StoreTypes } from "@connext/types";
import { isDirectory } from "@connext/utils";
import fs from "fs";
import { v4 as uuid } from "uuid";

import {
  env,
  expect,
  setAndGet,
  setAndGetMultiple,
  testAsyncStorageKey,
  createKeyValueStore,
  TEST_STORE_PAIR,
  createArray,
} from "../util";

import { storeTypes } from "./store.test";

describe("KeyValueStorage", () => {
  const length = 10;
  const asyncStorageKey = "TEST_CONNEXT_STORE";
  const fileDir = env.storeDir;
  const testValue = "something";

  describe("happy case: instantiate", () => {
    for (const type of storeTypes) {
      if (type === StoreTypes.Memory || type === StoreTypes.Postgres) {
        continue;
      }
      it(`should work for ${type}`, async () => {
        const store = createKeyValueStore(type as StoreTypes, { fileDir });
        await setAndGet(store);

        // test + validate entries
        const entries = await store.getEntries();
        expect(entries.length).to.eq(1);
        expect(entries[0]).to.deep.equal([TEST_STORE_PAIR.path, TEST_STORE_PAIR.value]);

        // test clearing
        await store.clear();
        const keys = await store.getKeys();
        expect(keys.length).to.be.eq(0);
      });
    }
  });

  describe("happy case: should be able to remove an item", async () => {
    for (const type of storeTypes) {
      if (type === StoreTypes.Memory || type === StoreTypes.Postgres) {
        continue;
      }
      it(`should work for ${type}`, async () => {
        const store = createKeyValueStore(type as StoreTypes, { fileDir });
        await setAndGet(store, TEST_STORE_PAIR);
        await store.removeItem(TEST_STORE_PAIR.path);
        const val = await store.getItem(TEST_STORE_PAIR.path);
        expect(val).to.be.undefined;
      });
    }
  });

  it("happy case: localStorage should include multiple keys", async () => {
    const store = createKeyValueStore(StoreTypes.LocalStorage);
    const preInsert = await store.getEntries();

    await setAndGetMultiple(store, length);

    expect((await store.getEntries()).length).to.equal(preInsert.length + length);
    await store.clear();
  });

  // TODO: fix test
  it.skip("happy case: AsyncStorage should include a single key matching asyncStorageKey", async () => {
    const store = createKeyValueStore(StoreTypes.AsyncStorage, { asyncStorageKey });

    await setAndGetMultiple(store, length);

    await testAsyncStorageKey(store, asyncStorageKey);
    await store.clear();
  });

  // TODO: ask pedro about the spirit of this test, and if it still needs to
  // be included/if its still relevant
  it.skip("happy case: FileStorage should include a single key matching asyncStorageKey", async () => {
    const store = createKeyValueStore(StoreTypes.File, { asyncStorageKey, fileDir });
    await setAndGetMultiple(store, length);
    await testAsyncStorageKey(store, asyncStorageKey);
    await store.clear();
  });

  it("happy case: FileStorage should create a store directory after first request", async () => {
    const id = uuid();
    const isDirectoryBefore = await isDirectory(`${fileDir}/${id}`);
    expect(isDirectoryBefore).to.be.false;
    const store = createKeyValueStore(StoreTypes.File, {
      asyncStorageKey,
      fileDir: `${fileDir}/${id}`,
    });

    await store.getSchemaVersion();

    const isDirectoryAfter = await isDirectory(`${fileDir}/${id}`);
    expect(isDirectoryAfter).to.be.true;
    await store.clear();
  });

  it("happy case: FileStorage should create a single file for all keys inside directory", async () => {
    const store = createKeyValueStore(StoreTypes.File, { asyncStorageKey, fileDir });

    const key1 = uuid();
    const key2 = uuid();
    expect(key1).to.not.equal(key2);
    await Promise.all([store.setItem(key2, testValue), store.setItem(key1, testValue)]);

    const files = await fs.readdirSync(fileDir);
    const verifyFile = (fileName: string): void => {
      const fileArr = files.filter((file: string) => file.includes(fileName));
      expect(fileArr.length).to.equal(1);
    };
    verifyFile(`${storeDefaults.PREFIX}-${storeKeys.STORE}.json`);
    await store.clear();
  });

  /**
   * TODO: resolve the questions with this test.
   *
   * Previously, the `prefix` in storeA was not included, and the test passed.
   * This is because there was a `this.uuid` property in the `FileStorage` class
   * that appended unique ids to the end of a file.
   *
   * However, that means if a client is using file storage, and comes back
   * online, a new uuid would be generated and they would not be able to access
   * previous store entries.
   *
   * Adding a unique prefix to each store fixed the test
   */
  it("happy case: FileStorage should create a files with unique name", async () => {
    const storeA = createKeyValueStore(StoreTypes.File, {
      asyncStorageKey,
      fileDir,
      prefix: "somethingDifferent",
    });
    const storeB = createKeyValueStore(StoreTypes.File, { asyncStorageKey, fileDir });

    const key = uuid();
    await Promise.all([storeA.setItem(key, testValue), storeB.setItem(key, testValue)]);

    const storeAFileName = `somethingDifferent-${storeKeys.STORE}.json`;
    const storeBFileName = `${storeDefaults.PREFIX}-${storeKeys.STORE}.json`;

    const files = await fs.readdirSync(fileDir);
    const filteredFiles = files.filter(
      (file: string) => file.includes(storeAFileName) || file.includes(storeBFileName),
    );
    expect(filteredFiles.length).to.equal(2);
    const file1 = filteredFiles[0].toLowerCase();
    const file2 = filteredFiles[1].toLowerCase();
    expect(file1 === file2).to.be.false;

    await storeA.clear();
    await storeB.clear();
  });

  describe("happy case: set & get the same path consecutively", async () => {
    for (const type of storeTypes) {
      if (type === StoreTypes.Memory || type === StoreTypes.Postgres) {
        continue;
      }
      it(`${type} should work`, async () => {
        const store = createKeyValueStore(type as StoreTypes, { fileDir });
        await Promise.all(createArray(5).map(() => setAndGet(store)));
      });
    }
  });

  describe("happy case: should join strings correctly", () => {
    for (const type of storeTypes) {
      if (type === StoreTypes.Memory || type === StoreTypes.Postgres) {
        continue;
      }
      it(`${type} should work`, async () => {
        const store = createKeyValueStore(type as StoreTypes, { fileDir });
        const expected = `expected${type === StoreTypes.File ? "-" : "/"}string`;
        expect(store.getKey("expected", "string")).to.be.equal(expected);
      });
    }
  });
});
