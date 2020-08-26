import { isDirectory } from "@connext/utils";
import fs from "fs";
import { Sequelize } from "sequelize";
import { v4 as uuid } from "uuid";

import { storeDefaults } from "../constants";
import { StoreTypes } from "../types";

import {
  createStore,
  expect,
  postgresConnectionUri,
  setAndGet,
  setAndGetMultiple,
  TEST_STORE_PAIR,
  testAsyncStorageKey,
} from "./utils";
import StoreService from "../store";

const storeTypes = Object.keys(StoreTypes);

const length = 10;
const asyncStorageKey = "TEST_CONNEXT_STORE";
const fileDir = "./.test-store";
const testValue = "something";

describe("Instantiation", () => {
  describe("instantiate", () => {
    for (const type of storeTypes) {
      it(`should work for ${type}`, async () => {
        const store = await createStore(type as StoreTypes);
        await setAndGet(store as StoreService);

        // test + validate entries
        const entries = await (store as StoreService).getEntries();
        expect(entries.length).to.eq(1);
        expect(entries[0]).to.deep.equal([TEST_STORE_PAIR.path, TEST_STORE_PAIR.value]);

        // test clearing
        await store.clear();
        const keys = await (store as StoreService).getKeys();
        expect(keys.length).to.be.eq(0);
      });
    }
  });

  describe("should be able to remove an item", async () => {
    for (const type of storeTypes) {
      it(`should work for ${type}`, async () => {
        const store = await createStore(type as StoreTypes);
        await setAndGet(store as StoreService, TEST_STORE_PAIR);
        await (store as StoreService).removeItem(TEST_STORE_PAIR.path);
        const val = await (store as StoreService).getItem(TEST_STORE_PAIR.path);
        expect(val).to.be.undefined;
      });
    }
  });

  it("memory storage should be able to support multiple stores", async () => {
    const store1 = await createStore(StoreTypes.Memory);
    await (store1 as StoreService).setItem("test", "store1");
    const store2 = await createStore(StoreTypes.Memory);
    await (store2 as StoreService).setItem("test", "store2");
    const item1 = await (store1 as StoreService).getItem("test");
    const item2 = await (store2 as StoreService).getItem("test");
    expect(item1).to.eq("store1");
    expect(item2).to.eq("store2");
    await store1.clear();
  });

  it("postgres storage should be able to create multiple stores with different prefixes", async () => {
    const sharedSequelize = new Sequelize(postgresConnectionUri, { logging: false });
    const store1 = await createStore(StoreTypes.Postgres, {
      sequelize: sharedSequelize,
      prefix: "store1",
    });
    await (store1 as StoreService).setItem("test", "store1");
    const store2 = await createStore(StoreTypes.Postgres, {
      sequelize: sharedSequelize,
      prefix: "store2",
    });
    await (store2 as StoreService).setItem("test", "store2");
    const item1 = await (store1 as StoreService).getItem("test");
    const item2 = await (store2 as StoreService).getItem("test");
    expect(item1).to.eq("store1");
    expect(item2).to.eq("store2");
    await store1.clear();
  });

  it("localStorage should include multiple keys", async () => {
    const store = await createStore(StoreTypes.LocalStorage);
    const preInsert = await (store as StoreService).getEntries();
    await setAndGetMultiple(store as StoreService, length);
    expect((await (store as StoreService).getEntries()).length).to.equal(preInsert.length + length);
    await store.clear();
  });

  // TODO: fix test
  it.skip("AsyncStorage should include a single key matching asyncStorageKey", async () => {
    const store = await createStore(StoreTypes.AsyncStorage, { asyncStorageKey });

    await setAndGetMultiple(store as StoreService, length);

    await testAsyncStorageKey(store as StoreService, asyncStorageKey);
    await store.clear();
  });

  // TODO: ask pedro about the spirit of this test, and if it still needs to
  // be included/if its still relevant
  it.skip("FileStorage should include a single key matching asyncStorageKey", async () => {
    const store = await createStore(StoreTypes.File, { asyncStorageKey });
    await setAndGetMultiple(store as StoreService, length);
    await testAsyncStorageKey(store as StoreService, asyncStorageKey);
    await store.clear();
  });

  it("FileStorage should create a store directory after first request", async () => {
    const id = uuid();
    const isDirectoryBefore = await isDirectory(`${fileDir}/${id}`);
    expect(isDirectoryBefore).to.be.false;
    const store = await createStore(StoreTypes.File, {
      asyncStorageKey,
      fileDir: `${fileDir}/${id}`,
    });
    await store.getSchemaVersion();
    const isDirectoryAfter = await isDirectory(`${fileDir}/${id}`);
    expect(isDirectoryAfter).to.be.true;
    await store.clear();
  });

  it("FileStorage should create a single file for all keys inside directory", async () => {
    const store = await createStore(StoreTypes.File, { asyncStorageKey, fileDir });
    const key1 = uuid();
    const key2 = uuid();
    expect(key1).to.not.equal(key2);
    await Promise.all([
      (store as StoreService).setItem(key2, testValue),
      (store as StoreService).setItem(key1, testValue),
    ]);
    const files = fs.readdirSync(fileDir);
    const verifyFile = (fileName: string): void => {
      const fileArr = files.filter((file: string) => file.includes(fileName));
      expect(fileArr.length).to.equal(1);
    };
    verifyFile(storeDefaults.SQLITE_STORE_NAME);
    await store.clear();
  });

  it("FileStorage should create dirs with unique name", async () => {
    const fileDirA = `${fileDir}/somethingdifferent1`;
    const fileDirB = `${fileDir}/somethingdifferent2`;
    const storeA = await createStore(StoreTypes.File, {
      asyncStorageKey,
      fileDir: fileDirA,
    });
    const storeB = await createStore(StoreTypes.File, {
      asyncStorageKey,
      fileDir: fileDirB,
    });
    const key = uuid();
    await Promise.all([
      (storeA as StoreService).setItem(key, testValue),
      (storeB as StoreService).setItem(key, testValue),
    ]);
    const filesA = fs.readdirSync(fileDir);
    const filesB = fs.readdirSync(fileDir);
    const verifyFile = (fileDir: string[]): void => {
      const fileArr = fileDir.filter((file: string) =>
        file.includes(storeDefaults.SQLITE_STORE_NAME),
      );
      expect(fileArr.length).to.equal(1);
    };
    verifyFile(filesA);
    verifyFile(filesB);
    await storeA.clear();
    await storeB.clear();
  });

  describe("set & get the same path consecutively", async () => {
    for (const type of storeTypes) {
      it(`${type} should work`, async () => {
        const store = await createStore(type as StoreTypes, { fileDir });
        await Promise.all(
          Array(5)
            .fill(0)
            .map(() => setAndGet(store as StoreService)),
        );
      });
    }
  });

  describe("should join strings correctly", () => {
    for (const type of storeTypes) {
      it(`${type} should work`, async () => {
        const store = await createStore(type as StoreTypes, { fileDir });
        const expected = `expected/string`;
        expect((store as StoreService).getKey("expected", "string")).to.be.equal(expected);
      });
    }
  });
});
