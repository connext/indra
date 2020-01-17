import { ConnextStore, FileStorage, MemoryStorage } from "@connext/store";
import localStorage from "localStorage";
import MockAsyncStorage from "mock-async-storage";

import { setAndGet } from "../util";

describe("Store", () => {
  it("happy case: instantiate with window.localStorage", async () => {
    const store = new ConnextStore(localStorage);
    expect(store).toBeInstanceOf(ConnextStore);
    await setAndGet(store);
  });

  it("happy case: instantiate with AsyncStorage", async () => {
    const AsyncStorage = new MockAsyncStorage();
    const store = new ConnextStore(AsyncStorage);
    expect(store).toBeInstanceOf(ConnextStore);
    await setAndGet(store);
  });

  it("happy case: instantiate with FileStorage", async () => {
    const store = new ConnextStore(new FileStorage());
    expect(store).toBeInstanceOf(ConnextStore);
    await setAndGet(store);
  });

  it("happy case: instantiate with MemoryStorage", async () => {
    const store = new ConnextStore(new MemoryStorage());
    expect(store).toBeInstanceOf(ConnextStore);
    await setAndGet(store);
  });
});
