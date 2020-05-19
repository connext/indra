import { IConnextClient, ProtocolNames } from "@connext/types";
import { Wallet } from "ethers";

import {
  createClient,
  createClientWithMessagingLimits,
  createDefaultClient,
  expect,
  SETUP_RESPONDER_RECEIVED_COUNT,
  SETUP_RESPONDER_SENT_COUNT,
  TestMessagingService,
  SEND,
  RECEIVED,
} from "../util";

describe("Create Channel", () => {
  let client: IConnextClient;
  afterEach(async () => {
    client && (await client.messaging.disconnect());
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

  it("Happy case: user creates channel with client and is given multisig address using test messaging service", async () => {
    client = await createClientWithMessagingLimits();
    expect(client.multisigAddress).to.be.ok;
    const messaging = client.messaging as TestMessagingService;
    expect(messaging).to.be.ok;
    expect(messaging.apiCount[SEND]).to.be.at.least(SETUP_RESPONDER_SENT_COUNT);
    expect(messaging.apiCount[RECEIVED]).to.be.at.least(SETUP_RESPONDER_RECEIVED_COUNT);
    expect(messaging.setupCount[SEND]).to.be.eq(SETUP_RESPONDER_SENT_COUNT);
    expect(messaging.setupCount[RECEIVED]).to.be.eq(SETUP_RESPONDER_RECEIVED_COUNT);
  });

  it("Creating a channel with mainnet network string fails if no signer is provided", async () => {
    await expect(createDefaultClient("mainnet", { signer: undefined })).to.be.rejectedWith(
      "Signer required for Mainnet",
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

  it("should fail if the client goes offline", async () => {
    await expect(
      createClientWithMessagingLimits({
        ceiling: { [RECEIVED]: 0 },
        protocol: ProtocolNames.setup,
      }),
    ).to.be.rejectedWith("Could not enable channel");
    const client = await createClientWithMessagingLimits();
    expect(client.multisigAddress).to.be.ok;
  });
});
