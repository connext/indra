import { ConnextStore, MemoryStorage, FileStorage } from "@connext/store";
import { StorePair } from "@connext/types";

import { AsyncStorage } from "../util";
import "../util/localStorage";

describe("Store", () => {
  const storePair: StorePair = { path: "testing", value: "something" };

  it("happy case: instantiate with window.localStorage", async () => {
    const store = new ConnextStore(window.localStorage);

    store.set([storePair]);
    store.get(storePair.path);
  });

  it("happy case: instantiate with AsyncStorage", async () => {
    const store = new ConnextStore(AsyncStorage);

    store.set([storePair]);
    store.get(storePair.path);
  });

  it("happy case: instantiate with FileStorage", async () => {
    const store = new ConnextStore(new FileStorage());

    store.set([storePair]);
    store.get(storePair.path);
  });

  it("happy case: instantiate with MemoryStorage", async () => {
    const store = new ConnextStore(new MemoryStorage());

    store.set([storePair]);
    store.get(storePair.path);
  });
});
