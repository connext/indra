import { MemoryStorage as MemoryStoreService } from "@connext/store";
import { Wallet } from "ethers";
import { JsonRpcProvider } from "ethers/providers";
import { HDNode } from "ethers/utils";

import { Node } from "./node";
import { memoryMessagingService } from "./testing/services";
import { MemoryLockService } from "./testing/services/memory-lock-service";

describe("Node", () => {
  it("is defined", () => {
    expect(Node).toBeDefined();
  });

  it("can be created", async () => {
    const hdNode = HDNode.fromMnemonic(Wallet.createRandom().mnemonic);
    const node = await Node.create(
      memoryMessagingService,
      new MemoryStoreService(),
      global["network"],
      { STORE_KEY_PREFIX: "./node.spec.ts-test-file" },
      new JsonRpcProvider(global["ganacheURL"]),
      new MemoryLockService(),
      hdNode.neuter().extendedKey,
      (index: string): Promise<string> => Promise.resolve(hdNode.derivePath(index).privateKey),
    );

    expect(node).toBeDefined();
  });
});
