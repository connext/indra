import { getDirectoryFiles, isDirectorySync } from "@connext/store";
import uuid from "uuid";

import {
  env,
  expect,
  setAndGet,
  setAndGetMultiple,
  testAsyncStorageKey,
  createKeyValueStore,
  TEST_STORE_PAIR,
} from "../util";
import { LOCALSTORAGE, ASYNCSTORAGE, FILESTORAGE } from "@connext/types";

describe("KeyValueStorage", () => {
  const length = 10;
  const asyncStorageKey = "TEST_CONNEXT_STORE";
  const fileDir = env.storeDir;
  const testValue = "something";

  it("happy case: instantiate with localStorage", async () => {
    const store = createKeyValueStore(LOCALSTORAGE);
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

  // TODO: fix async storage build with mocha
  it.skip("happy case: instantiate with AsyncStorage", async () => {
    const store = createKeyValueStore(ASYNCSTORAGE);
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

  it("happy case: instantiate with FileStorage", async () => {
    const store = createKeyValueStore(FILESTORAGE, { asyncStorageKey, fileDir });
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

  it("happy case: localStorage should include multiple keys", async () => {
    const store = createKeyValueStore(LOCALSTORAGE);

    await setAndGetMultiple(store, length);

    expect((await store.getEntries()).length).to.equal(length);
    await store.clear();
  });

  // TODO: fix async storage build with mocha, does not like the
  // `react-native` dependency
  it.skip("happy case: AsyncStorage should include a single key matching asyncStorageKey", async () => {
    const store = createKeyValueStore(ASYNCSTORAGE, { asyncStorageKey });

    await setAndGetMultiple(store, length);

    await testAsyncStorageKey(store, asyncStorageKey);
    await store.clear();
  });

  // TODO: ask pedro about the spirit of this test, and if it still needs to
  // be included/if its still relevant
  it.skip("happy case: FileStorage should include a single key matching asyncStorageKey", async () => {
    const store = createKeyValueStore(FILESTORAGE, { asyncStorageKey, fileDir });
    await setAndGetMultiple(store, length);
    await testAsyncStorageKey(store, asyncStorageKey);
    await store.clear();
  });

  it("happy case: FileStorage should create a store directory", async () => {
    const store = createKeyValueStore(FILESTORAGE, { asyncStorageKey, fileDir });

    expect(isDirectorySync(fileDir)).to.be.true;
    await store.clear();
  });

  it("happy case: FileStorage should create a file per key inside directory", async () => {
    const store = createKeyValueStore(FILESTORAGE, { asyncStorageKey, fileDir });

    const key1 = uuid.v4();
    const key2 = uuid.v4();
    expect(key1).to.not.equal(key2);
    await Promise.all([store.setItem(key2, testValue), store.setItem(key1, testValue)]);

    const files = await getDirectoryFiles(fileDir);
    const verifyFile = (fileName: string): void => {
      const fileArr = files.filter((file: string) => file.includes(fileName));
      expect(fileArr.length).to.equal(1);
    };
    verifyFile(key1);
    verifyFile(key2);
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
    const storeA = createKeyValueStore(FILESTORAGE, {
      asyncStorageKey,
      fileDir,
      prefix: "somethingDifferent",
    });
    const storeB = createKeyValueStore(FILESTORAGE, { asyncStorageKey, fileDir });

    const key = uuid.v4();
    await Promise.all([storeA.setItem(key, testValue), storeB.setItem(key, testValue)]);

    const files = await getDirectoryFiles(fileDir);
    const filteredFiles = files.filter((file: string) => file.includes(key));
    expect(filteredFiles.length).to.equal(2);
    const file1 = filteredFiles[0].toLowerCase();
    const file2 = filteredFiles[1].toLowerCase();
    expect(file1 === file2).to.be.false;

    await storeA.clear();
    await storeB.clear();
  });
});
