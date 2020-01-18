import { getDirectoryFiles, IAsyncStorage, isDirectorySync } from "@connext/store";
import uuid from "uuid";

import {
  createStore,
  env,
  expect,
  setAndGet,
  setAndGetMultiple,
  testAsyncStorageKey,
} from "../util";

describe("Storage", () => {
  const length = 10;
  const asyncStorageKey = "TEST_CONNEXT_STORE";
  const fileDir = env.storeDir;
  const testValue = "something";

  it("happy case: instantiate with localStorage", async () => {
    const { store, storage } = createStore("localstorage");
    await setAndGet(store);
    await storage.clear();
  });

  it("happy case: instantiate with AsyncStorage", async () => {
    const { store, storage } = createStore("asyncstorage");
    await setAndGet(store);
    await storage.clear();
  });

  it("happy case: instantiate with MemoryStorage", async () => {
    const { store, storage } = createStore("memorystorage");
    await setAndGet(store);
    await storage.clear();
  });

  it("happy case: instantiate with FileStorage", async () => {
    const { store, storage } = createStore("filestorage", { asyncStorageKey }, { fileDir });
    await setAndGet(store);
    await storage.clear();
  });

  it("happy case: localStorage should include multiple keys", async () => {
    const { store, storage } = createStore("localstorage");

    await setAndGetMultiple(store, length);

    expect((storage as Storage).length).to.equal(length);
    await storage.clear();
  });

  it("happy case: AsyncStorage should include a single key matching asyncStorageKey", async () => {
    const { store, storage } = createStore("asyncstorage", { asyncStorageKey });

    await setAndGetMultiple(store, length);

    await testAsyncStorageKey(storage as IAsyncStorage, asyncStorageKey);
    await storage.clear();
  });

  it("happy case: MemoryStorage should include a single key matching asyncStorageKey", async () => {
    const { store, storage } = createStore("memorystorage", { asyncStorageKey });

    await setAndGetMultiple(store, length);

    await testAsyncStorageKey(storage as IAsyncStorage, asyncStorageKey);
    await storage.clear();
  });

  it("happy case: FileStorage should include a single key matching asyncStorageKey", async () => {
    const { store, storage } = createStore("filestorage", { asyncStorageKey }, { fileDir });

    await setAndGetMultiple(store, length);

    await testAsyncStorageKey(storage as IAsyncStorage, asyncStorageKey);
    await storage.clear();
  });

  it("happy case: FileStorage should create a store directory", async () => {
    const { storage } = createStore("filestorage", { asyncStorageKey }, { fileDir });

    expect(isDirectorySync(fileDir)).to.be.true;
    await storage.clear();
  });

  it("happy case: FileStorage should create a file per key inside directory", async () => {
    const { storage } = createStore("filestorage", { asyncStorageKey }, { fileDir });

    const key1 = uuid.v4();
    const key2 = uuid.v4();
    expect(key1).to.not.equal(key2);
    await Promise.all([storage.setItem(key2, testValue), storage.setItem(key1, testValue)]);

    const files = await getDirectoryFiles(fileDir);
    const verifyFile = (fileName: string): void => {
      const fileArr = files.filter((file: string) => file.includes(fileName));
      expect(fileArr.length).to.equal(1);
    };
    verifyFile(key1);
    verifyFile(key2);
    await storage.clear();
  });

  it("happy case: FileStorage should create a files with unique name", async () => {
    const { storage: storageA } = createStore("filestorage", { asyncStorageKey }, { fileDir });
    const { storage: storageB } = createStore("filestorage", { asyncStorageKey }, { fileDir });

    const key = uuid.v4();
    await Promise.all([storageA.setItem(key, testValue), storageB.setItem(key, testValue)]);

    const files = await getDirectoryFiles(fileDir);
    const filteredFiles = files.filter((file: string) => file.includes(key));
    expect(filteredFiles.length).to.equal(2);
    const file1 = filteredFiles[0].toLowerCase();
    const file2 = filteredFiles[1].toLowerCase();
    expect(file1 === file2).to.be.false;

    await storageA.clear();
    await storageB.clear();
  });
});
