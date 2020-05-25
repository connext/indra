import { getMemoryStore } from "@connext/store";
import { getRandomChannelSigner } from "@connext/utils";
import { providers } from "ethers";
import { MemoryLockService } from "./testing/services/memory-lock-service";

import { CFCore } from "./cfCore";
import { memoryMessagingService } from "./testing/services";

describe("CFCore", () => {
  it("is defined", () => {
    expect(CFCore).toBeDefined();
  });

  it("can be created", async () => {
    const provider = new providers.JsonRpcProvider(global["wallet"].provider.connection.url);
    // TODO: getMemoryStore should run init() internally
    const store = getMemoryStore();
    await store.init();
    const node = await CFCore.create(
      memoryMessagingService,
      store,
      global["contracts"],
      { STORE_KEY_PREFIX: "./node.spec.ts-test-file" },
      provider,
      getRandomChannelSigner(),
      new MemoryLockService(),
    );

    expect(node).toBeDefined();
  });
});
