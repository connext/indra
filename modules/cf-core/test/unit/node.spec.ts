import { JsonRpcProvider } from "ethers/providers";

import { Node } from "../../src/node";
import { MemoryStoreService } from "../services/memory-store-service";
import mockMessagingService from "../services/mock-messaging-service";
import { testDomainSeparator } from "../integration/utils";

describe("Node", () => {
  it("is defined", () => {
    expect(Node).toBeDefined();
  });

  it("can be created", async () => {
    const node = await Node.create(
      mockMessagingService,
      new MemoryStoreService(),
      global["networkContext"],
      { STORE_KEY_PREFIX: "./node.spec.ts-test-file" },
      new JsonRpcProvider(global["ganacheURL"]),
      testDomainSeparator()
    );

    expect(node).toBeDefined();
  });
});
