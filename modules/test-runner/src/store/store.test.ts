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
  });

  it("happy case: set & get the same path consecutively", async () => {
    await Promise.all(createArray(5).map(() => setAndGet(store)));
  });

  it("happy case: get channels map indexed by multisigAddress", async () => {
    const xpub =
      "xpub6FLhjUvMxAuTfCrrNYFJ8qxq4Tx7FuYWVgbRv1TwBhfbtasEZP8EQcmD62jrhaaywiBkxcbEGHciBFwcf56B2mrtUnCBa92L3XbDzf85J4A";
    const multisigAddress1 = "0x5a0b54d5dc17e0aadc383d2db43b0a0d3e029c4b";
    const multisigAddress2 = "0x829BD824B016326A401d083B33D092293333A831";
    const path = `${xpub}/${PATH_CHANNEL}`;
    const pairs: StorePair[] = [
      { path: `${path}/${multisigAddress1}`, value: { multisigAddress: multisigAddress1 } },
      { path: `${path}/${multisigAddress2}`, value: { multisigAddress: multisigAddress2 } },
    ];
    await store.set(pairs);
    const expected = {
      [multisigAddress1]: pairs[0].value,
      [multisigAddress2]: pairs[1].value,
    };
    const retrieved = await store.get(path);
    expect(retrieved).to.deep.equal(expected);
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
