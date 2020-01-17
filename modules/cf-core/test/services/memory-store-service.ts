import { ConnextStore, MemoryStorage } from "@connext/store";
import { CFCoreTypes } from "@connext/types";

export class MemoryStoreService extends ConnextStore
  implements CFCoreTypes.IStoreService {
  constructor(storage: any, opts?: any) {
    super(storage, opts);
  }
}

export class MemoryStoreServiceFactory implements CFCoreTypes.ServiceFactory {
  constructor(private readonly delay: number = 0) {}
  createStoreService(): CFCoreTypes.IStoreService {
    const memoryStorage = new MemoryStorage(this.delay);
    const store = new MemoryStoreService(memoryStorage);
    return store;
  }
}
