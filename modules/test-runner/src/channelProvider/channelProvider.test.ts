import { xkeyKthAddress } from "@connext/cf-core";
import { IChannelProvider, IConnextClient, SwapParameters } from "@connext/types";
import { AddressZero, Zero } from "ethers/constants";
import { bigNumberify } from "ethers/utils";

import {
  asyncTransferAsset,
  calculateExchange,
  createChannelProvider,
  createClient,
  createRemoteClient,
  ETH_AMOUNT_SM,
  ONE,
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
    ////////////////////////////////////////
    // DEPOSIT FLOW
    // client deposit and request node collateral
    const depositAmount = ETH_AMOUNT_SM;
    await clientA1.deposit({ amount: depositAmount.toString(), assetId: AddressZero });
    await clientA1.requestCollateral(tokenAddress);

    ////////////////////////////////////////
    // SWAP FLOW
    // check balances pre
    const {
      [clientA1.freeBalanceAddress]: preSwapFreeBalanceEthClient,
      [nodeFreeBalanceAddress]: preSwapFreeBalanceEthNode,
    } = await clientA1.getFreeBalance(AddressZero);
    expect(preSwapFreeBalanceEthClient).toBeBigNumberEq(depositAmount);
    expect(preSwapFreeBalanceEthNode).toBeBigNumberEq(Zero);

    const {
      [clientA1.freeBalanceAddress]: preSwapFreeBalanceTokenClient,
      [nodeFreeBalanceAddress]: preSwapFreeBalanceTokenNode,
    } = await clientA1.getFreeBalance(tokenAddress);
    expect(preSwapFreeBalanceTokenNode).toBeBigNumberEq(TOKEN_AMOUNT);
    expect(preSwapFreeBalanceTokenClient).toBeBigNumberEq(Zero);

    const swapRate = await clientA1.getLatestSwapRate(AddressZero, tokenAddress);

    const swapAmount = bigNumberify(ONE);
    const swapParams: SwapParameters = {
      amount: swapAmount.toString(),
      fromAssetId: AddressZero,
      swapRate,
      toAssetId: tokenAddress,
    };
    await clientA1.swap(swapParams);

    const expectedTokenSwapAmount = calculateExchange(swapAmount, swapRate);

    const {
      [clientA1.freeBalanceAddress]: postSwapFreeBalanceEthClient,
      [nodeFreeBalanceAddress]: postSwapFreeBalanceEthNode,
    } = await clientA1.getFreeBalance(AddressZero);
    expect(postSwapFreeBalanceEthClient).toBeBigNumberEq(
      preSwapFreeBalanceEthClient.sub(swapAmount),
    );
    expect(postSwapFreeBalanceEthNode).toBeBigNumberEq(swapAmount);

    const {
      [clientA1.freeBalanceAddress]: postSwapFreeBalanceTokenClient,
      [nodeFreeBalanceAddress]: postSwapFreeBalanceTokenNode,
    } = await clientA1.getFreeBalance(tokenAddress);
    expect(postSwapFreeBalanceTokenClient).toBeBigNumberEq(expectedTokenSwapAmount);
    expect(postSwapFreeBalanceTokenNode).toBeBigNumberEq(
      preSwapFreeBalanceTokenNode.sub(expectedTokenSwapAmount),
    );

    ////////////////////////////////////////
    // TRANSFER FLOW
    const transferAmount = bigNumberify(ONE);
    const assetId = AddressZero;
    const clientB = await createClient();
    await clientB.requestCollateral(AddressZero);

    await asyncTransferAsset(clientA1, clientB, transferAmount, assetId, nodeFreeBalanceAddress, {
      freeBalanceClientA: postSwapFreeBalanceEthClient,
      freeBalanceNodeA: postSwapFreeBalanceEthNode,
    });

    ////////////////////////////////////////
    // WITHDRAW FLOW
    const withdrawAmount = bigNumberify(ONE);
    await withdrawFromChannel(clientA1, withdrawAmount.toString(), AddressZero);
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
