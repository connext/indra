import {
  ConnextStore,
  MemoryStorage,
  PATH_CHANNEL,
  PATH_PROPOSED_APP_INSTANCE_ID,
  StorePair,
} from "@connext/store";
import { hexlify, randomBytes } from "ethers/utils";

import {
  createArray,
  createStore,
  expect,
  MockBackupService,
  setAndGet,
  setAndGetMultiple,
  MEMORYSTORAGE,
} from "../util";

describe("Store", () => {
  let memoryStorage: MemoryStorage;
  let store: ConnextStore;

  beforeEach(async () => {
    const { store: testStore, storage } = createStore(MEMORYSTORAGE);
    memoryStorage = storage as MemoryStorage;
    store = testStore;
  }, 90_000);

  it("happy case: set & get the same path consecutively", async () => {
    await Promise.all(createArray(5).map(() => setAndGet(store)));
  });

  it("happy case: get partial matches when available", async () => {
    const names = [PATH_PROPOSED_APP_INSTANCE_ID, PATH_CHANNEL];
    const subdir = `partial`;
    for (const name of names) {
      const pair: StorePair = {
        path: `${name}/${subdir}`,
        value: { ilyk: "tests" },
      };
      await setAndGet(store, pair);
      const retrieved = await store.get(name);
      expect(retrieved).to.deep.equal({ [subdir]: pair.value });
    }
  });

  it("happy case: reset the whole store state", async () => {
    expect((await memoryStorage.getAllKeys()).length).to.equal(0);
    await setAndGet(store);
    expect((await memoryStorage.getAllKeys()).length).to.be.greaterThan(0);
    await store.reset();
    expect(await memoryStorage.getAllKeys()).to.deep.equal([]);
  });

  it("happy case: backup state when provided a backupService", async () => {
    // create store with backup service
    const backupService = new MockBackupService();
    const { store } = createStore(MEMORYSTORAGE, { backupService });
    // generate value to properly set and backup
    const pair: StorePair = {
      path: `/xpub/channel/${hexlify(randomBytes(20))}`,
      value: { freeBalanceAppInstance: { test: "pls" } },
    };
    await store.set([pair], true);
    // restore and check states restored
    const statesRestored = await store.restore();
    expect(statesRestored).to.deep.equal([pair]);
    // check store is properly setup
    expect(await store.get(pair.path)).to.deep.equal(pair.value);
  });

  it("happy case: restore empty state without backupService", async () => {
    await setAndGetMultiple(store);
    // restore
    const statesRestored = await store.restore();
    // expect that store has proper prefix
    expect(statesRestored).to.be.deep.equal([]);
    expect(await memoryStorage.getAllKeys()).to.be.deep.equal([]);
  });
});
