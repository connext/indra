import { getMemoryStore } from "@connext/store";

export class MemoryStoreServiceFactory {
  createStoreService() {
    return getMemoryStore();
  }
}
