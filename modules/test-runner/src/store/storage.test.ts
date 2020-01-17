import { isDirectorySync } from "@connext/store";

import {
  createStore,
  expect,
  readDir,
  setAndGet,
  setAndGetMultiple,
  testAsyncStorageKey,
} from "../util";

describe("Storage", () => {
  const length = 10;
  const asyncStorageKey = "TEST_CONNEXT_STORE";
  const fileDir = "./.test-store";
  const testValue = "something";

  it("happy case: instantiate with localStorage", async () => {
    const { store } = createStore("localstorage");
    await setAndGet(store);
  });

  it("happy case: instantiate with AsyncStorage", async () => {
    const { store } = createStore("asyncstorage");
    await setAndGet(store);
  });

  it("happy case: instantiate with MemoryStorage", async () => {
    const { store } = createStore("memorystorage");
    await setAndGet(store);
  });

  it("happy case: instantiate with FileStorage", async () => {
    const { store } = createStore("filestorage", { asyncStorageKey }, { fileDir });
    await setAndGet(store);
  });

  it("happy case: localStorage should include multiple keys", async () => {
    const { store, storage } = createStore("localstorage");

    await setAndGetMultiple(store, length);

    expect((storage as Storage).length).to.equal(length);
  });

  it("happy case: AsyncStorage should include a single key matching asyncStorageKey", async () => {
    const { store, storage } = createStore("asyncstorage", { asyncStorageKey });

    await setAndGetMultiple(store, length);

    await testAsyncStorageKey(storage, asyncStorageKey);
  });

  it("happy case: MemoryStorage should include a single key matching asyncStorageKey", async () => {
    const { store, storage } = createStore("memorystorage", { asyncStorageKey });

    await setAndGetMultiple(store, length);

    await testAsyncStorageKey(storage, asyncStorageKey);
  });

  it("happy case: FileStorage should include a single key matching asyncStorageKey", async () => {
    const { store, storage } = createStore("filestorage", { asyncStorageKey });

    await setAndGetMultiple(store, length);

    await testAsyncStorageKey(storage, asyncStorageKey);
  });

  it("happy case: FileStorage should create a store directory", async () => {
    createStore("filestorage", { asyncStorageKey }, { fileDir });

    expect(isDirectorySync(fileDir)).to.be.true;
  });

  it("happy case: FileStorage should create a file per key inside directory", async () => {
    const { storage } = createStore("filestorage", { asyncStorageKey }, { fileDir });

    const key1 = "testing-1";
    storage.setItem(key1, testValue);
    const key2 = "testing-2";
    storage.setItem(key2, testValue);

    const files = await readDir(fileDir);
    expect(files.length).to.equal(2);
    const file1 = files.filter((fileName: string) => fileName.includes(key1));
    expect(file1.length).to.equal(1);
    const file2 = files.filter((fileName: string) => fileName.includes(key2));
    expect(file2.length).to.equal(1);
  });

  it("happy case: FileStorage should create a files with unique name", async () => {
    const { storage: storageA } = createStore("filestorage", { asyncStorageKey }, { fileDir });
    const { storage: storageB } = createStore("filestorage", { asyncStorageKey }, { fileDir });

    const key = "testing-1";
    storageA.setItem(key, testValue);
    storageB.setItem(key, testValue);

    const files = await readDir(fileDir);
    expect(files.length).to.equal(2);
    const file1 = files[0].toLowerCase();
    const file2 = files[1].toLowerCase();
    expect(file1 === file2).to.be.false;
  });
});
