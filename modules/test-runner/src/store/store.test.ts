import {
  ConnextStore,
  PATH_CHANNEL,
  PATH_PROPOSED_APP_INSTANCE_ID,
  StorePair,
} from "@connext/store";

import { createStore, expect, setAndGet } from "../util";

describe.only("Store", () => {
  let memoryStorage: Storage;
  let store: ConnextStore;

  beforeEach(async () => {
    const { store: testStore, storage } = createStore("memorystorage");
    memoryStorage = storage as Storage;
    store = testStore;
  }, 90_000);

  it("happy case: set & get the same path consecutively", async () => {
    for (const _ of Array(5)) {
      await setAndGet(store);
    }
  });

  it("happy case: get partial matches when available", async () => {
    // TODO: happy case: get partial matches when available
    const names = [PATH_PROPOSED_APP_INSTANCE_ID, PATH_CHANNEL];
    const keyspace = `partial`;
    for (const name of names) {
      const pair: StorePair = {
        path: `${name}/${keyspace}`,
        value: { ilyk: "tests" },
      };
      await setAndGet(store, pair);
      const retrieved = await store.get(name);
      expect(retrieved).to.deep.equal({ [keyspace]: pair.value });
    }
  });

  it("happy case: reset the whole store state", async () => {
    // TODO: happy case: reset the whole store state
  });

  it("happy case: backup state when provided a backupService", async () => {
    // TODO: happy case: backup state when provided a backupService
  });

  it("happy case: restore empty state without backupService", async () => {
    // TODO: happy case: restore empty state without backupService
  });
});
