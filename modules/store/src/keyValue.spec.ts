import { expect } from "chai";
import {
  setAndGet,
  setAndGetMultiple,
  testAsyncStorageKey,
  createKeyValueStore,
  TEST_STORE_PAIR,
  postgresConnectionUri,
} from "./test-utils";
import { StoreTypes } from "./types";
import { Sequelize } from "sequelize";

const storeTypes = Object.values(StoreTypes);

describe("KeyValueStorage", () => {
  const length = 10;
  const asyncStorageKey = "TEST_CONNEXT_STORE";

  describe("happy case: instantiate", () => {
    for (const type of storeTypes) {
      it(`should work for ${type}`, async () => {
        const store = await createKeyValueStore(type as StoreTypes);
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
        const store = await createKeyValueStore(type as StoreTypes);
        await setAndGet(store, TEST_STORE_PAIR);
        await store.removeItem(TEST_STORE_PAIR.path);
        const val = await store.getItem(TEST_STORE_PAIR.path);
        expect(val).to.be.undefined;
      });
    }
  });

  it("happy case: memory storage should be able to support multiple stores", async () => {
    const store1 = await createKeyValueStore(StoreTypes.Memory);
    await store1.setItem("test", "store1");
    const store2 = await createKeyValueStore(StoreTypes.Memory);
    await store2.setItem("test", "store2");
    const item1 = await store1.getItem("test");
    const item2 = await store2.getItem("test");
    expect(item1).to.eq("store1");
    expect(item2).to.eq("store2");
    await store1.clear();
  });

  it("happy case: postgres storage should be able to create multiple stores with different prefixes", async () => {
    const sharedSequelize = new Sequelize(postgresConnectionUri, { logging: false });
    const store1 = await createKeyValueStore(StoreTypes.Postgres, {
      sequelize: sharedSequelize,
      prefix: "store1",
    });
    await store1.setItem("test", "store1");
    const store2 = await createKeyValueStore(StoreTypes.Postgres, {
      sequelize: sharedSequelize,
      prefix: "store2",
    });
    await store2.setItem("test", "store2");
    const item1 = await store1.getItem("test");
    const item2 = await store2.getItem("test");
    expect(item1).to.eq("store1");
    expect(item2).to.eq("store2");
    await store1.clear();
  });

  it("happy case: localStorage should include multiple keys", async () => {
    const store = await createKeyValueStore(StoreTypes.LocalStorage);
    const preInsert = await store.getEntries();
    await setAndGetMultiple(store, length);
    expect((await store.getEntries()).length).to.equal(preInsert.length + length);
    await store.clear();
  });

  // TODO: fix test
  it.skip("happy case: AsyncStorage should include a single key matching asyncStorageKey", async () => {
    const store = await createKeyValueStore(StoreTypes.AsyncStorage, { asyncStorageKey });

    await setAndGetMultiple(store, length);

    await testAsyncStorageKey(store, asyncStorageKey);
    await store.clear();
  });

  describe("happy case: set & get the same path consecutively", async () => {
    for (const type of storeTypes) {
      it(`${type} should work`, async () => {
        const store = await createKeyValueStore(type as StoreTypes);
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
        const store = await createKeyValueStore(type as StoreTypes);
        const expected = `expected/string`;
        expect(store.getKey("expected", "string")).to.be.equal(expected);
      });
    }
  });
});
