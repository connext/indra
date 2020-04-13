import { IConnextClient } from "@connext/types";

import {
  createClient,
  createClientWithMessagingLimits,
  createDefaultClient,
  expect,
  SETUP_RESPONDER_RECEIVED_COUNT,
  SETUP_RESPONDER_SENT_COUNT,
  TestMessagingService,
} from "../util";
import { Wallet } from "ethers";

describe("Create Channel", () => {
  let client: IConnextClient;
  afterEach(async () => {
    await client.messaging.disconnect();
  });

  it("Happy case: user creates channel with mainnet network string", async () => {
    client = await createDefaultClient("mainnet");
    expect(client.multisigAddress).to.be.ok;
  });

  it("Happy case: user creates channel with rinkeby network string", async () => {
    client = await createDefaultClient("rinkeby");
    expect(client.multisigAddress).to.be.ok;
  });

  it("Happy case: user creates channel with node and is given multisig address", async () => {
    client = await createClient();
    expect(client.multisigAddress).to.be.ok;
  });

  it.skip("Happy case: user creates channel with client and is given multisig address using test messaging service", async () => {
    client = await createClientWithMessagingLimits();
    expect(client.multisigAddress).to.be.ok;
    const messaging = client.messaging as TestMessagingService;
    expect(messaging).to.be.ok;
    expect(messaging!.count.sent).to.be.gte(SETUP_RESPONDER_SENT_COUNT);
    expect(messaging!.count.received).to.be.gte(SETUP_RESPONDER_RECEIVED_COUNT);
    expect(messaging!.setup.received).to.be.equal(SETUP_RESPONDER_RECEIVED_COUNT);
    expect(messaging!.setup.sent).to.be.equal(SETUP_RESPONDER_SENT_COUNT);
    expect(messaging!.installVirtual.received).to.be.equal(0);
    expect(messaging!.installVirtual.sent).to.be.equal(0);
  });

  it("Creating a channel with mainnet network string fails if no signer is provided", async () => {
    await expect(createDefaultClient("mainnet", { signer: undefined })).to.be.rejectedWith(
      "Must provide channelProvider or signer",
    );
  });

  it("Creating a channel fails if user address and node address are the same", async () => {
    const nodeMnemonic: string =
      "candy maple cake sugar pudding cream honey rich smooth crumble sweet treat";
    const { privateKey } = Wallet.fromMnemonic(nodeMnemonic);
    await expect(createClient({ signer: privateKey })).to.be.rejectedWith(
      "Client must be instantiated with a signer that is different from the node's",
    );
  });

  it.skip("should fail if the client goes offline", async () => {
    await expect(
      createClientWithMessagingLimits({
        ceiling: { received: 0 },
        protocol: "setup",
      }),
    ).to.be.rejectedWith("Create channel event not fired within 30s");
  });
});
