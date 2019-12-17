import { CFCoreTypes } from "@connext/types";

class MockStoreService implements CFCoreTypes.IStoreService {
  get() {
    return Promise.resolve(true);
  }

  set() {
    return Promise.resolve();
  }
}

const mockStoreService = new MockStoreService();
export default mockStoreService;
