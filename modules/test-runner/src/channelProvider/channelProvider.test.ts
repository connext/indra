import { xkeyKthAddress } from "@connext/cf-core";
import { IChannelProvider, IConnextClient, RECIEVE_TRANSFER_FINISHED_EVENT } from "@connext/types";
import { AddressZero, One } from "ethers/constants";
import { Client } from "ts-nats";

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
import { createOrRetrieveNatsConnection } from "../util/nats";

describe(`ChannelProvider`, () => {
  let clientA: IConnextClient;
  let clientA1: IConnextClient;
  let tokenAddress: string;
  let nodeFreeBalanceAddress: string;
  let nodePublicIdentifier: string;
  let channelProvider: IChannelProvider;
  let natsConnection: Client;

  beforeEach(async function () {
    // @ts-ignore
    this.timeout(90_000);
    clientA = await createClient();
    tokenAddress = clientA.config.contractAddresses.Token;
    nodePublicIdentifier = clientA.config.nodePublicIdentifier;
    nodeFreeBalanceAddress = xkeyKthAddress(nodePublicIdentifier);
    channelProvider = await createChannelProvider(clientA);
    clientA1 = await createRemoteClient(channelProvider);
    natsConnection = await createOrRetrieveNatsConnection();
  });

  it(`Happy case: client A1 can be instantiated with a channelProvider generated from client A`, async function () {
    const _tokenAddress = clientA1.config.contractAddresses.Token;
    const _nodePublicIdentifier = clientA1.config.nodePublicIdentifier;
    const _nodeFreeBalanceAddress = xkeyKthAddress(nodePublicIdentifier);

    expect(_tokenAddress).to.be.eq(tokenAddress);
    expect(_nodePublicIdentifier).to.be.eq(nodePublicIdentifier);
    expect(_nodeFreeBalanceAddress).to.be.eq(nodeFreeBalanceAddress);
  });

  it(`Happy case: Bot A1 can call the full deposit → swap → transfer → withdraw flow on Bot A`, async function () {
    // @ts-ignore
    this.timeout(90_000);

    const input: AssetOptions = { amount: ETH_AMOUNT_SM, assetId: AddressZero };
    const output: AssetOptions = { amount: TOKEN_AMOUNT, assetId: tokenAddress };

    ////////////////////////////////////////
    // DEPOSIT FLOW
    await fundChannel(clientA, input.amount, input.assetId);
    await clientA1.requestCollateral(output.assetId);

    ////////////////////////////////////////
    // SWAP FLOW
    await swapAsset(
      clientA1,
      input,
      output,
      nodeFreeBalanceAddress,
    );

    ////////////////////////////////////////
    // TRANSFER FLOW
    const transfer: AssetOptions = { amount: One, assetId: tokenAddress };
    const clientB = await createClient();
    await clientB.requestCollateral(tokenAddress);

    // TODO: Move natsConnection to MockChannelProvider and use asyncTransferAsset test
    const transferFinished = Promise.all([
      new Promise(async resolve => {
        const sub = await natsConnection.subscribe(
          `indra.node.${clientA.nodePublicIdentifier}.uninstall.>`,
          () => {
            resolve();
            sub.unsubscribe();
          },
        );
      }),
      new Promise(async resolve => {
        clientB.once(RECIEVE_TRANSFER_FINISHED_EVENT, async () => {
          resolve();
        });
      }),
    ]);

    await clientA1.transfer({
      amount: transfer.amount.toString(),
      assetId: transfer.assetId,
      recipient: clientB.publicIdentifier,
    });

    await transferFinished;

    ////////////////////////////////////////
    // WITHDRAW FLOW
    const withdraw: AssetOptions = { amount: One, assetId: tokenAddress };
    await withdrawFromChannel(clientA1, withdraw.amount, withdraw.assetId);
  });

  it(`Bot A1 tries to call a function when Bot A is offline`, async () => {
    // close channelProvider connection
    clientA1.channelProvider.close();

    await expect(clientA1.getFreeBalance(AddressZero)).to.be.rejectedWith(
      `RpcConnection: Timeout - JSON-RPC not responded within 30s`,
    );
  });

  it.skip(`Bot A1 tries to reject installing a proposed app that bot A has already installed?`, async () => {
    // TODO: add test
  });
});
