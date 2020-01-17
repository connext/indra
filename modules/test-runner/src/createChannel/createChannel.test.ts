import { IConnextClient } from "@connext/types";

import { createClient, expect } from "../util";

describe("Create Channel", () => {
  beforeEach(async () => {});

  it("Happy case: user creates channel with node and is given multisig address", async () => {
    const clientA: IConnextClient = await createClient();
    expect(clientA.multisigAddress).to.be.ok;
  });

  it("Creating a channel fails if user xpub and node xpub are the same", async () => {
    const nodeMnemonic: string =
      "candy maple cake sugar pudding cream honey rich smooth crumble sweet treat";
    await expect(createClient({ mnemonic: nodeMnemonic })).to.be.rejectedWith(
      "Client must be instantiated with a mnemonic that is different from the node's mnemonic",
    );
  });
});
