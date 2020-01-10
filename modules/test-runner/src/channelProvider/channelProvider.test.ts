import { xkeyKthAddress } from "@connext/cf-core";
import { connect } from "@connext/client";
import { ClientOptions, IConnextClient } from "@connext/types";

import ChannelProvider from "../channelProvider";
import MockConnection from "../mockConnection";
import { env } from "../util";
import { createClient } from "../util/client";

describe("ChannelProvider", () => {
  let clientA: IConnextClient;
  let clientB: IConnextClient;
  let tokenAddress: string;
  let nodeFreeBalanceAddress: string;
  let nodePublicIdentifier: string;
  let mockConnection: MockConnection;
  let channelProvider: ChannelProvider;

  beforeEach(async () => {
    clientA = await createClient();
    tokenAddress = clientA.config.contractAddresses.Token;
    nodePublicIdentifier = clientA.config.nodePublicIdentifier;
    nodeFreeBalanceAddress = xkeyKthAddress(nodePublicIdentifier);
    mockConnection = new MockConnection(clientA);
    channelProvider = new ChannelProvider(mockConnection);
    channelProvider.enable();
  }, 90_000);

  test("Happy case: client A1 can be instantiated with a channelProvider generated from client A", async () => {
    const clientOpts: ClientOptions = {
      channelProvider,
      ethProviderUrl: env.ethProviderUrl,
      logLevel: env.logLevel,
    };

    clientB = await connect(clientOpts);

    await clientB.isAvailable();

    expect(clientB.freeBalanceAddress).toBeTruthy();
    expect(clientB.publicIdentifier).toBeTruthy();
  });
});
