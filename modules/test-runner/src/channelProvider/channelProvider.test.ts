import { xkeyKthAddress } from "@connext/cf-core";
import { IConnextClient } from "@connext/types";

import { ChannelProvider, createChannelProvider, createClient, createRemoteClient } from "../util";

describe("ChannelProvider", () => {
  let clientA: IConnextClient;
  let clientB: IConnextClient;
  let tokenAddress: string;
  let nodeFreeBalanceAddress: string;
  let nodePublicIdentifier: string;
  let channelProvider: ChannelProvider;

  beforeEach(async () => {
    clientA = await createClient();
    tokenAddress = clientA.config.contractAddresses.Token;
    nodePublicIdentifier = clientA.config.nodePublicIdentifier;
    nodeFreeBalanceAddress = xkeyKthAddress(nodePublicIdentifier);
    channelProvider = await createChannelProvider(clientA);
  }, 90_000);

  test("Happy case: client A1 can be instantiated with a channelProvider generated from client A", async () => {
    clientB = await createRemoteClient(channelProvider);
  });
});
