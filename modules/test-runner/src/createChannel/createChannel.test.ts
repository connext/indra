import { IConnextClient } from "@connext/types";

import { CREATE_INITIATOR_COUNT, CREATE_RESPONDER_COUNT, expect } from "../util";
import { createClient, getMessaging } from "../util/client";

describe("Create Channel", () => {
  beforeEach(async () => {});

  it("Happy case: user creates channel with node and is given multisig address", async () => {
    const clientA: IConnextClient = await createClient();
    expect(clientA.multisigAddress).to.be.ok;
    // verify messaging worked
    const messaging = getMessaging();
    expect(messaging.count.sent.toString()).to.be.equal(CREATE_RESPONDER_COUNT);
    expect(messaging.count.received.toString()).to.be.equal(CREATE_INITIATOR_COUNT);
  });

  it("Creating a channel fails if user xpub and node xpub are the same", async () => {
    const nodeMnemonic: string =
      "candy maple cake sugar pudding cream honey rich smooth crumble sweet treat";
    await expect(createClient({ mnemonic: nodeMnemonic })).to.be.rejectedWith(
      "Client must be instantiated with a mnemonic that is different from the node's mnemonic",
    );
  });
});
