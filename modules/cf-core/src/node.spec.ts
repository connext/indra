import { MemoryStorage as MemoryStoreService } from "@connext/store";
import { Wallet } from "ethers";
import { JsonRpcProvider } from "ethers/providers";

import { Node } from "./node";
import { memoryMessagingService } from "./testing/services";
import { ChannelSigner } from "@connext/crypto";

describe("Node", () => {
  it("is defined", () => {
    expect(Node).toBeDefined();
  });

  it("can be created", async () => {
    const provider = new JsonRpcProvider(global["ganacheURL"]);
    const node = await Node.create(
      memoryMessagingService,
      new MemoryStoreService(),
      global["network"],
      { STORE_KEY_PREFIX: "./node.spec.ts-test-file" },
      provider,
      new ChannelSigner(
        Wallet.createRandom().privateKey,
        provider.network.chainId,
      ),
    );

    expect(node).toBeDefined();
  });
});
