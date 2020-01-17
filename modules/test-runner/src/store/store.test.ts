import { ConnextStore, MemoryStorage } from "@connext/store";

describe("Store", () => {
  let memoryStorage: MemoryStorage;
  let store: ConnextStore;

  beforeEach(async () => {
    memoryStorage = new MemoryStorage();
    store = new ConnextStore(memoryStorage);
  }, 90_000);

  it("happy case: set & get the same path consecutively", async () => {
    // TODO: happy case: set & get the same path consecutively
  });

  it("happy case: get partial matches when available", async () => {
    // TODO: happy case: get partial matches when available
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
