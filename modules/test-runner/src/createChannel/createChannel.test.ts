import { IConnextClient } from "@connext/types";

import { createClient } from "../util/client";

describe("Create Channel", async () => {
  beforeEach(async () => {});

  test("Happy case: user creates channel with node and is given multisig address", async () => {
    const clientA: IConnextClient = await createClient();
    expect(clientA.multisigAddress).toBeDefined();
  });

  test("Creating a channel fails if user xpub and node xpub are the same", async () => {
    const nodeMnemonic: string =
      "candy maple cake sugar pudding cream honey rich smooth crumble sweet treat";
    await expect(createClient({ mnemonic: nodeMnemonic })).rejects.toThrowError("test");
  });
});
