import { Wallet } from "ethers";
import { JsonRpcProvider } from "ethers/providers";
import { HDNode } from "ethers/utils";

import { Node } from "../../src/node";
import { MemoryStoreService } from "../services/memory-store-service";
import mockMessagingService from "../services/mock-messaging-service";

describe.only("Node", () => {
  it("is defined", () => {
    expect(Node).toBeDefined();
  });

  it("can be created", async () => {
    const hdNode = HDNode.fromMnemonic(Wallet.createRandom().mnemonic);
    const node = await Node.create(
      mockMessagingService,
      new MemoryStoreService(),
      global["networkContext"],
      { STORE_KEY_PREFIX: "./node.spec.ts-test-file" },
      new JsonRpcProvider(global["ganacheURL"]),
      undefined,
      hdNode.neuter().extendedKey,
      (index: string): Promise<string> => Promise.resolve(hdNode.derivePath(index).privateKey),
    );

    expect(node).toBeDefined();
  });
});
