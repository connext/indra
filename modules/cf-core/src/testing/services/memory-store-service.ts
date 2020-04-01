import { MemoryStorage } from "@connext/store";

export class MemoryStoreServiceFactory {
  createStoreService() {
    return new MemoryStorage();
  }
}
