import { ConnextStore, MemoryStorage } from "@connext/store";

describe("Store", () => {
  let memoryStorage: MemoryStorage;
  let store: ConnextStore;

  beforeEach(async () => {
    memoryStorage = new MemoryStorage();
    store = new ConnextStore(memoryStorage);
  }, 90_000);

  it("happy case: instantiate with window.localStorage", async () => {
    // TODO: happy case: instantiate with window.localStorage
  });

  it("happy case: instantiate with AsyncStorage", async () => {
    // TODO: happy case: instantiate with AsyncStorage
  });

  it("happy case: instantiate with FileStorage", async () => {
    // TODO: happy case: instantiate with FileStorage
  });

  it("happy case: instantiate with MemoryStorage", async () => {
    // TODO: happy case: instantiate with MemoryStorage
  });
});
