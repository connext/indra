import { ConnextStore } from "@connext/store";
import { StoreTypes } from "@connext/types";

export class MemoryStoreServiceFactory {
  createStoreService() {
    return new ConnextStore(StoreTypes.Memory);
  }
}
