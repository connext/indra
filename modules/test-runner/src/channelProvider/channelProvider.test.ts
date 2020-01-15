import { xkeyKthAddress } from "@connext/cf-core";
import { IChannelProvider, IConnextClient } from "@connext/types";
import { AddressZero, One } from "ethers/constants";
import { Client } from "ts-nats";

import {
  AssetOptions,
  // asyncTransferAsset,
  createChannelProvider,
  createClient,
  createRemoteClient,
  ETH_AMOUNT_SM,
  fundChannel,
  swapAsset,
  TOKEN_AMOUNT,
  withdrawFromChannel,
} from "../util";
import { createOrRetrieveNatsConnection } from "../util/nats";

describe("ChannelProvider", () => {
  let clientA: IConnextClient;
  let clientA1: IConnextClient;
  let tokenAddress: string;
  let nodeFreeBalanceAddress: string;
  let nodePublicIdentifier: string;
  let channelProvider: IChannelProvider;
  let natsConnection: Client;

  beforeAll(async () => {
    natsConnection = await createOrRetrieveNatsConnection();
  });

  beforeEach(async () => {
    clientA = await createClient();
    tokenAddress = clientA.config.contractAddresses.Token;
    nodePublicIdentifier = clientA.config.nodePublicIdentifier;
    nodeFreeBalanceAddress = xkeyKthAddress(nodePublicIdentifier);
    channelProvider = await createChannelProvider(clientA);
    clientA1 = await createRemoteClient(channelProvider);
  }, 90_000);

  // tslint:disable-next-line:max-line-length
  test("Happy case: client A1 can be instantiated with a channelProvider generated from client A", async () => {
    // tslint:disable-next-line:variable-name
    const _tokenAddress = clientA1.config.contractAddresses.Token;
    // tslint:disable-next-line:variable-name
    const _nodePublicIdentifier = clientA1.config.nodePublicIdentifier;
    // tslint:disable-next-line:variable-name
    const _nodeFreeBalanceAddress = xkeyKthAddress(nodePublicIdentifier);

    expect(_tokenAddress).toBe(tokenAddress);
    expect(_nodePublicIdentifier).toBe(nodePublicIdentifier);
    expect(_nodeFreeBalanceAddress).toBe(nodeFreeBalanceAddress);
  });

  // tslint:disable-next-line:max-line-length
  test("Happy case: Bot A1 can call the full deposit → swap → transfer → withdraw flow on Bot A", async () => {
    const input: AssetOptions = { amount: ETH_AMOUNT_SM, assetId: AddressZero };
    const output: AssetOptions = { amount: TOKEN_AMOUNT, assetId: tokenAddress };

    ////////////////////////////////////////
    // DEPOSIT FLOW
    await fundChannel(clientA, input.amount, input.assetId);
    await clientA1.requestCollateral(output.assetId);

    ////////////////////////////////////////
    // SWAP FLOW
    const { freeBalanceClientToken, freeBalanceNodeToken } = await swapAsset(
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
        clientB.once("RECIEVE_TRANSFER_FINISHED_EVENT", async () => {
          console.error(`Caught receive finished event!!!!!`);
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

  // tslint:disable-next-line:max-line-length
  test("Bot A1 tries to call a function when Bot A is offline", async () => {
    // close channelProvider connection
    clientA1.channelProvider.close();

    await expect(clientA1.getFreeBalance(AddressZero)).rejects.toThrowError(
      "RpcConnection: Timeout - JSON-RPC not responded within 30s",
    );
  });

  // tslint:disable-next-line:max-line-length
  test.skip("Bot A1 tries to reject installing a proposed app that bot A has already installed?", async () => {
    // TODO: add test
  });
});
