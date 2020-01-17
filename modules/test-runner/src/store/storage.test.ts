import { ConnextStore, MemoryStorage } from "@connext/store";

describe("Store", () => {
  let memoryStorage: MemoryStorage;
  let store: ConnextStore;

  beforeEach(async () => {
    memoryStorage = new MemoryStorage();
    store = new ConnextStore(memoryStorage);
  }, 90_000);

  it("happy case: localStorage should include multiple keys", async () => {
    // TODO: happy case: localStorage should include multiple keys
  });

  it("happy case: AsyncStorage should include a single key", async () => {
    // TODO: happy case: AsyncStorage should include a single key
  });

  it("happy case: FileStorage should create a store directory", async () => {
    // TODO: happy case: FileStorage should create a store directory
  });

  it("happy case: FileStorage should create a file per key inside directory", async () => {
    // TODO: happy case: FileStorage should create a file per key inside directory
  });

  it("happy case: FileStorage should create a files with unique name", async () => {
    // TODO: happy case: FileStorage should create a files with unique name
  });
});
