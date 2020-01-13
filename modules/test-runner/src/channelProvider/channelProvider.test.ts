import { xkeyKthAddress } from "@connext/cf-core";
import { IChannelProvider, IConnextClient } from "@connext/types";
import { AddressZero } from "ethers/constants";
import { bigNumberify } from "ethers/utils";

import {
  asyncTransferAsset,
  createChannelProvider,
  createClient,
  createRemoteClient,
  ETH_AMOUNT_SM,
  ONE,
  swapAsset,
  TOKEN_AMOUNT,
  withdrawFromChannel,
} from "../util";

describe("ChannelProvider", () => {
  let clientA: IConnextClient;
  let clientA1: IConnextClient;
  let tokenAddress: string;
  let nodeFreeBalanceAddress: string;
  let nodePublicIdentifier: string;
  let channelProvider: IChannelProvider;

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
    const input = { amount: ETH_AMOUNT_SM, assetId: AddressZero };
    const output = { amount: TOKEN_AMOUNT, assetId: tokenAddress };

    ////////////////////////////////////////
    // DEPOSIT FLOW
    await clientA1.deposit({ amount: input.amount.toString(), assetId: input.assetId });
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
    const transfer = { amount: bigNumberify(ONE), assetId: tokenAddress };
    const clientB = await createClient();
    await clientB.requestCollateral(tokenAddress);

    await asyncTransferAsset(
      clientA1,
      clientB,
      transfer.amount,
      transfer.assetId,
      nodeFreeBalanceAddress,
      {
        freeBalanceClientA: freeBalanceClientToken,
        freeBalanceNodeA: freeBalanceNodeToken,
      },
    );

    ////////////////////////////////////////
    // WITHDRAW FLOW
    const withdraw = { amount: bigNumberify(ONE), assetId: tokenAddress };
    await withdrawFromChannel(clientA1, withdraw.amount.toString(), withdraw.assetId);
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
