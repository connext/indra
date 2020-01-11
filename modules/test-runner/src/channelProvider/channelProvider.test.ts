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
    console.log("[beforeEach]", "===========>", true);

    clientA = await createClient();
    console.log("[beforeEach]", "clientA", clientA);

    tokenAddress = clientA.config.contractAddresses.Token;
    console.log("[beforeEach]", "tokenAddress", tokenAddress);

    nodePublicIdentifier = clientA.config.nodePublicIdentifier;
    console.log("[beforeEach]", "nodePublicIdentifier", nodePublicIdentifier);

    nodeFreeBalanceAddress = xkeyKthAddress(nodePublicIdentifier);
    console.log("[beforeEach]", "nodeFreeBalanceAddress", nodeFreeBalanceAddress);

    channelProvider = await createChannelProvider(clientA);
    console.log("[beforeEach]", "channelProvider", channelProvider);
  }, 90_000);

  // tslint:disable-next-line:max-line-length
  test("Happy case: client A1 can be instantiated with a channelProvider generated from client A", async () => {
    console.log(" ====> Starting test with clientA", clientA);
    console.log(" ====> Starting test with clientB", clientB);
    console.log(" ====> Starting test with tokenAddress", tokenAddress);
    console.log(" ====> Starting test with nodeFreeBalanceAddress", nodeFreeBalanceAddress);
    console.log(" ====> Starting test with nodePublicIdentifier", nodePublicIdentifier);
    console.log(" ====> Starting test with channelProvider", channelProvider);

    clientB = await createRemoteClient(channelProvider);

    console.log("[TEST]", "clientB", clientB);

    // tslint:disable-next-line:variable-name
    const _tokenAddress = clientB.config.contractAddresses.Token;
    console.log("[TEST]", "_tokenAddress", _tokenAddress);
    // tslint:disable-next-line:variable-name
    const _nodePublicIdentifier = clientB.config.nodePublicIdentifier;
    console.log("[TEST]", "_nodePublicIdentifier", _nodePublicIdentifier);
    // tslint:disable-next-line:variable-name
    const _nodeFreeBalanceAddress = xkeyKthAddress(nodePublicIdentifier);
    console.log("[TEST]", "_nodeFreeBalanceAddress", _nodeFreeBalanceAddress);

    expect(_tokenAddress).toBe(tokenAddress);
    expect(_nodePublicIdentifier).toBe(nodeFreeBalanceAddress);
    expect(_nodeFreeBalanceAddress).toBe(nodePublicIdentifier);
  });
});
