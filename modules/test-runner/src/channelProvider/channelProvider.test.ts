import { createClient } from "../util/client";
import { IConnextClient } from "@connext/types";
import { xkeyKthAddress } from "@connext/cf-core";
import WalletConnectChannelProvider from "@walletconnect/channel-provider";

describe("ChannelProvider", () => {
  let clientA: IConnextClient;
  let tokenAddress: string;
  let nodeFreeBalanceAddress: string;
  let nodePublicIdentifier: string;
  let channelProvider: WalletConnectChannelProvider;

  beforeEach(async () => {
    clientA = await createClient();
    tokenAddress = clientA.config.contractAddresses.Token;
    nodePublicIdentifier = clientA.config.nodePublicIdentifier;
    nodeFreeBalanceAddress = xkeyKthAddress(nodePublicIdentifier);
    channelProvider = new WalletConnectChannelProvider({ qrcode: false });
    channelProvider.enable();
  }, 90_000);

  test("Happy case: client A1 can be instantiated with a channelProvider generated from client A", async () => {
    
  })
});
