import { getMemoryStore } from "@connext/store";
import { getRandomChannelSigner } from "@connext/utils";
import { JsonRpcProvider } from "ethers/providers";

import { CFCore } from "./cfCore";
import { memoryMessagingService } from "./testing/services";

describe("CFCore", () => {
  it("is defined", () => {
    expect(CFCore).toBeDefined();
  });

  it("can be created", async () => {
    const provider = new JsonRpcProvider(global["network"].provider.connection.url);
    const node = await CFCore.create(
      memoryMessagingService,
      getMemoryStore(),
      global["network"],
      { STORE_KEY_PREFIX: "./node.spec.ts-test-file" },
      provider,
      getRandomChannelSigner(),
    );

    expect(node).toBeDefined();
  });
});
