import { isDirectory } from "@connext/utils";
import { expect } from "chai";
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

const storeTypes = Object.keys(StoreTypes);

const length = 10;
const asyncStorageKey = "TEST_CONNEXT_STORE";
const fileDir = "./.test-store";
const testValue = "something";

describe("Instantiation", () => {
  describe("happy case: instantiate", () => {
    for (const type of storeTypes) {
      it(`should work for ${type}`, async () => {
        const store = await createStore(type as StoreTypes);
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
      it(`should work for ${type}`, async () => {
        const store = await createStore(type as StoreTypes);
        await setAndGet(store, TEST_STORE_PAIR);
        await store.removeItem(TEST_STORE_PAIR.path);
        const val = await store.getItem(TEST_STORE_PAIR.path);
        expect(val).to.be.undefined;
      });
    }
  });

  it("happy case: memory storage should be able to support multiple stores", async () => {
    const store1 = await createStore(StoreTypes.Memory);
    await store1.setItem("test", "store1");
    const store2 = await createStore(StoreTypes.Memory);
    await store2.setItem("test", "store2");
    const item1 = await store1.getItem("test");
    const item2 = await store2.getItem("test");
    expect(item1).to.eq("store1");
    expect(item2).to.eq("store2");
    await store1.clear();
  });

  it("happy case: postgres storage should be able to create multiple stores with different prefixes", async () => {
    const sharedSequelize = new Sequelize(postgresConnectionUri, { logging: false });
    const store1 = await createStore(StoreTypes.Postgres, { sequelize: sharedSequelize, prefix: "store1" });
    await store1.setItem("test", "store1");
    const store2 = await createStore(StoreTypes.Postgres, { sequelize: sharedSequelize, prefix: "store2" });
    await store2.setItem("test", "store2");
    const item1 = await store1.getItem("test");
    const item2 = await store2.getItem("test");
    expect(item1).to.eq("store1");
    expect(item2).to.eq("store2");
    await store1.clear();
  });

  it("happy case: localStorage should include multiple keys", async () => {
    const store = await createStore(StoreTypes.LocalStorage);
    const preInsert = await store.getEntries();
    await setAndGetMultiple(store, length);
    expect((await store.getEntries()).length).to.equal(preInsert.length + length);
    await store.clear();
  });

  // TODO: fix test
  it.skip("happy case: AsyncStorage should include a single key matching asyncStorageKey", async () => {
    const store = await createStore(StoreTypes.AsyncStorage, { asyncStorageKey });

    await setAndGetMultiple(store, length);

    await testAsyncStorageKey(store, asyncStorageKey);
    await store.clear();
  });

  // TODO: ask pedro about the spirit of this test, and if it still needs to
  // be included/if its still relevant
  it.skip("happy case: FileStorage should include a single key matching asyncStorageKey", async () => {
    const store = await createStore(StoreTypes.File, { asyncStorageKey });
    await setAndGetMultiple(store, length);
    await testAsyncStorageKey(store, asyncStorageKey);
    await store.clear();
  });

  it("happy case: FileStorage should create a store directory after first request", async () => {
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

  it("happy case: FileStorage should create a single file for all keys inside directory", async () => {
    const store = await createStore(StoreTypes.File, { asyncStorageKey, fileDir });
    const key1 = uuid();
    const key2 = uuid();
    expect(key1).to.not.equal(key2);
    await Promise.all([store.setItem(key2, testValue), store.setItem(key1, testValue)]);
    const files = fs.readdirSync(fileDir);
    const verifyFile = (fileName: string): void => {
      const fileArr = files.filter((file: string) => file.includes(fileName));
      expect(fileArr.length).to.equal(1);
    };
    verifyFile(storeDefaults.SQLITE_STORE_NAME);
    await store.clear();
  });

  it("happy case: FileStorage should create dirs with unique name", async () => {
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
    await Promise.all([storeA.setItem(key, testValue), storeB.setItem(key, testValue)]);
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

  describe("happy case: set & get the same path consecutively", async () => {
    for (const type of storeTypes) {
      it(`${type} should work`, async () => {
        const store = await createStore(type as StoreTypes, { fileDir });
        await Promise.all(
          Array(5)
            .fill(0)
            .map(() => setAndGet(store)),
        );
      });
    }
  });

  describe("happy case: should join strings correctly", () => {
    for (const type of storeTypes) {
      it(`${type} should work`, async () => {
        const store = await createStore(type as StoreTypes, { fileDir });
        const expected = `expected/string`;
        expect(store.getKey("expected", "string")).to.be.equal(expected);
      });
    }
  });
});
