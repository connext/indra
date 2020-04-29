import { ConnextStore } from "@connext/store";
import { getRandomChannelSigner } from "@connext/utils";
import { providers } from "ethers";

import { Node } from "./node";
import { memoryMessagingService } from "./testing/services";
import { StoreTypes } from "@connext/types";

describe("Node", () => {
  it("is defined", () => {
    expect(Node).toBeDefined();
  });

  it("can be created", async () => {
    const provider = new providers.JsonRpcProvider(global["network"].provider.connection.url);
    const node = await Node.create(
      memoryMessagingService,
      new ConnextStore(StoreTypes.Memory),
      global["network"],
      { STORE_KEY_PREFIX: "./node.spec.ts-test-file" },
      provider,
      getRandomChannelSigner(),
    );

    expect(node).toBeDefined();
  });
});
