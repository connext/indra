import { EventNames, IConnextClient, CONVENTION_FOR_ETH_ASSET_ID } from "@connext/types";
import { getAddressFromAssetId, getSignerAddressFromPublicIdentifier } from "@connext/utils";
import { constants } from "ethers";

import {
  AssetOptions,
  createChannelProvider,
  createClient,
  createRemoteClient,
  ETH_AMOUNT_SM,
  expect,
  fundChannel,
  swapAsset,
  TOKEN_AMOUNT,
  withdrawFromChannel,
} from "../util";

const { AddressZero, One } = constants;

describe("ChannelProvider", () => {
  let client: IConnextClient;
  let remoteClient: IConnextClient;
  let nodeSignerAddress: string;
  let nodeIdentifier: string;
  let tokenAddress: string;

  beforeEach(async () => {
    client = await createClient({ id: "A" });
    remoteClient = await createRemoteClient(await createChannelProvider(client));
    nodeIdentifier = client.config.nodeIdentifier;
    nodeSignerAddress = client.nodeSignerAddress;
    tokenAddress = client.config.contractAddresses.Token!;
  });

  afterEach(async () => {
    await client.messaging.disconnect();
  });

  it("Happy case: remote client can be instantiated with a channelProvider", async () => {
    const _tokenAddress = remoteClient.config.contractAddresses.Token!;
    const _nodeIdentifier = remoteClient.config.nodeIdentifier;
    const _nodeSignerAddress = getSignerAddressFromPublicIdentifier(nodeIdentifier);
    expect(_tokenAddress).to.be.eq(tokenAddress);
    expect(_nodeIdentifier).to.be.eq(nodeIdentifier);
    expect(_nodeSignerAddress).to.be.eq(nodeSignerAddress);
  });

  it("Happy case: remote client can call the full deposit → swap → transfer → withdraw flow", async () => {
    const input: AssetOptions = { amount: ETH_AMOUNT_SM, assetId: CONVENTION_FOR_ETH_ASSET_ID };
    const output: AssetOptions = { amount: TOKEN_AMOUNT, assetId: tokenAddress };

    ////////////////////////////////////////
    // DEPOSIT FLOW
    await fundChannel(client, input.amount, input.assetId);
    await remoteClient.requestCollateral(getAddressFromAssetId(output.assetId));

    ////////////////////////////////////////
    // SWAP FLOW
    await swapAsset(remoteClient, input, output, nodeSignerAddress);

    ////////////////////////////////////////
    // TRANSFER FLOW
    const transfer: AssetOptions = { amount: One, assetId: tokenAddress };
    const clientB = await createClient({ id: "B" });
    await clientB.requestCollateral(tokenAddress);

    const transferFinished = new Promise(async (resolve) => {
      clientB.once(EventNames.CONDITIONAL_TRANSFER_UNLOCKED_EVENT, async () => {
        resolve();
      });
    });

    await remoteClient.transfer({
      amount: transfer.amount.toString(),
      assetId: transfer.assetId,
      recipient: clientB.publicIdentifier,
    });

    await transferFinished;

    ////////////////////////////////////////
    // WITHDRAW FLOW
    const withdraw: AssetOptions = { amount: One, assetId: tokenAddress };
    await withdrawFromChannel(remoteClient, withdraw.amount, withdraw.assetId);
  });

  it("Remote client tries to call a function when client is offline", async () => {
    // close channelProvider connection
    remoteClient.channelProvider.close();
    await expect(remoteClient.getFreeBalance(AddressZero)).to.be.rejectedWith(
      "RpcConnection: Timeout - JSON-RPC not responded within 30s",
    );
  });

  it.skip("Remote client tries to reject installing a proposed app that client has already installed?", async () => {
    // TODO: add test
  });
});
