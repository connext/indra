import { getRandomChannelSigner } from "@connext/utils";
import { MemoryStorage as MemoryStoreService } from "@connext/store";
import { JsonRpcProvider } from "ethers/providers";

import { Node } from "./node";
import { memoryMessagingService } from "./testing/services";

describe("Node", () => {
  it("is defined", () => {
    expect(Node).toBeDefined();
  });

  it("can be created", async () => {
    const provider = new JsonRpcProvider(global["network"].provider.connection.url);
    const node = await Node.create(
      memoryMessagingService,
      new MemoryStoreService(),
      global["network"],
      { STORE_KEY_PREFIX: "./node.spec.ts-test-file" },
      provider,
      await getRandomChannelSigner(),
    );

    expect(node).toBeDefined();
  });
});
