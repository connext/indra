import { EventNames, IConnextClient, CONVENTION_FOR_ETH_ASSET_ID } from "@connext/types";
import { getAddressFromAssetId, getSignerAddressFromPublicIdentifier } from "@connext/utils";
import { constants } from "ethers";

import {
  ETH_AMOUNT_SM,
  TOKEN_AMOUNT,
  createChannelProvider,
  createClient,
  createRemoteClient,
  expect,
  fundChannel,
  getTestLoggers,
  swapAsset,
  withdrawFromChannel,
} from "./util";

const { AddressZero, One } = constants;

const name = "Channel Provider";
const { timeElapsed } = getTestLoggers(name);
describe(name, () => {
  let client: IConnextClient;
  let nodeIdentifier: string;
  let nodeSignerAddress: string;
  let remoteClient: IConnextClient;
  let start: number;
  let tokenAddress: string;

  beforeEach(async () => {
    start = Date.now();
    client = await createClient({ id: "A" });
    remoteClient = await createRemoteClient(await createChannelProvider(client));
    nodeIdentifier = client.config.nodeIdentifier;
    nodeSignerAddress = client.nodeSignerAddress;
    tokenAddress = client.config.contractAddresses[client.chainId].Token!;
    timeElapsed("beforeEach complete", start);
  });

  afterEach(async () => {
    await client.off();
  });

  it("Happy case: remote client can be instantiated with a channelProvider", async () => {
    const _tokenAddress = Object.values(remoteClient.config.contractAddresses)[0]!.Token!;
    const _nodeIdentifier = remoteClient.config.nodeIdentifier;
    const _nodeSignerAddress = getSignerAddressFromPublicIdentifier(nodeIdentifier);
    expect(_tokenAddress).to.be.eq(tokenAddress);
    expect(_nodeIdentifier).to.be.eq(nodeIdentifier);
    expect(_nodeSignerAddress).to.be.eq(nodeSignerAddress);
  });

  it("Happy case: remote client can call the full deposit → swap → transfer → withdraw flow", async () => {
    const input = { amount: ETH_AMOUNT_SM, assetId: CONVENTION_FOR_ETH_ASSET_ID };
    const output = { amount: TOKEN_AMOUNT, assetId: tokenAddress };

    ////////////////////////////////////////
    // DEPOSIT FLOW
    await fundChannel(client, input.amount, input.assetId);
    await remoteClient.requestCollateral(getAddressFromAssetId(output.assetId));

    ////////////////////////////////////////
    // SWAP FLOW
    await swapAsset(remoteClient, input, output, nodeSignerAddress);

    ////////////////////////////////////////
    // TRANSFER FLOW
    const transfer = { amount: One, assetId: tokenAddress };
    const clientB = await createClient({ id: "B" });
    await clientB.requestCollateral(tokenAddress);

    const transferFinished = clientB.waitFor(
      EventNames.CONDITIONAL_TRANSFER_UNLOCKED_EVENT,
      10_000,
    );

    await remoteClient.transfer({
      amount: transfer.amount.toString(),
      assetId: transfer.assetId,
      recipient: clientB.publicIdentifier,
    });

    await transferFinished;

    ////////////////////////////////////////
    // WITHDRAW FLOW
    const withdraw = { amount: One, assetId: tokenAddress };
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
