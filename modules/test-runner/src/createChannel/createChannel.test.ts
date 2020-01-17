import { IConnextClient } from "@connext/types";

import {
  createClient,
  expect,
  getMessaging,
  SETUP_RESPONDER_RECEIVED_COUNT,
  SETUP_RESPONDER_SENT_COUNT,
} from "../util";

describe("Create Channel", () => {
  it("Happy case: user creates channel with node and is given multisig address", async () => {
    const clientA: IConnextClient = await createClient();
    expect(clientA.multisigAddress).to.be.ok;
    // verify messaging worked
    const messaging = getMessaging();
    expect(messaging.count.sent).to.be.gte(SETUP_RESPONDER_SENT_COUNT);
    expect(messaging.count.received).to.be.gte(SETUP_RESPONDER_RECEIVED_COUNT);
    expect(messaging.setup.received).to.be.equal(SETUP_RESPONDER_RECEIVED_COUNT);
    expect(messaging.setup.sent).to.be.equal(SETUP_RESPONDER_SENT_COUNT);
    expect(messaging.installVirtual.received).to.be.equal(0);
    expect(messaging.installVirtual.sent).to.be.equal(0);
  });

  it("Creating a channel fails if user xpub and node xpub are the same", async () => {
    const nodeMnemonic: string =
      "candy maple cake sugar pudding cream honey rich smooth crumble sweet treat";
    await expect(createClient({ mnemonic: nodeMnemonic })).to.be.rejectedWith(
      "Client must be instantiated with a mnemonic that is different from the node's mnemonic",
    );
  });
});
