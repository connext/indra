import { xkeyKthAddress } from "@connext/cf-core";
import { IChannelProvider, IConnextClient, SwapParameters } from "@connext/types";
import { AddressZero, Zero } from "ethers/constants";
import { BigNumber } from "ethers/utils";

import {
  calculateExchange,
  createChannelProvider,
  createClient,
  createRemoteClient,
  TEST_ETH_AMOUNT,
  TEST_TOKEN_AMOUNT,
} from "../util";

describe("ChannelProvider", () => {
  let clientA: IConnextClient;
  let clientA1: IConnextClient;
  let ethAmount: BigNumber;
  let tokenAmount: BigNumber;
  let tokenAddress: string;
  let nodeFreeBalanceAddress: string;
  let nodePublicIdentifier: string;
  let channelProvider: IChannelProvider;

  beforeEach(async () => {
    clientA = await createClient();
    ethAmount = TEST_ETH_AMOUNT;
    tokenAmount = TEST_TOKEN_AMOUNT;
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
    await clientA1.deposit({ amount: ethAmount.toString(), assetId: AddressZero });
    await clientA1.requestCollateral(tokenAddress);

    ////////////////////////////////////////
    // SWAP FLOW

    // check balances pre
    const {
      [clientA1.freeBalanceAddress]: preSwapFreeBalanceEthClient,
      [nodeFreeBalanceAddress]: preSwapFreeBalanceEthNode,
    } = await clientA1.getFreeBalance(AddressZero);
    expect(preSwapFreeBalanceEthClient).toBeBigNumberEq(ethAmount);
    expect(preSwapFreeBalanceEthNode).toBeBigNumberEq(Zero);

    const {
      [clientA1.freeBalanceAddress]: preSwapFreeBalanceTokenClient,
      [nodeFreeBalanceAddress]: preSwapFreeBalanceTokenNode,
    } = await clientA1.getFreeBalance(tokenAddress);
    expect(preSwapFreeBalanceTokenNode).toBeBigNumberEq(tokenAmount);
    expect(preSwapFreeBalanceTokenClient).toBeBigNumberEq(Zero);

    const swapRate = await clientA1.getLatestSwapRate(AddressZero, tokenAddress);

    const swapAmount = ethAmount;
    const swapParams: SwapParameters = {
      amount: swapAmount.toString(),
      fromAssetId: AddressZero,
      swapRate,
      toAssetId: tokenAddress,
    };
    await clientA1.swap(swapParams);

    const {
      [clientA1.freeBalanceAddress]: postSwapFreeBalanceEthClient,
      [nodeFreeBalanceAddress]: postSwapFreeBalanceEthNode,
    } = await clientA1.getFreeBalance(AddressZero);
    const {
      [clientA1.freeBalanceAddress]: postSwapFreeBalanceTokenClient,
      [nodeFreeBalanceAddress]: postSwapFreeBalanceTokenNode,
    } = await clientA1.getFreeBalance(tokenAddress);

    expect(postSwapFreeBalanceEthClient).toBeBigNumberEq(
      preSwapFreeBalanceEthClient.sub(swapAmount),
    );
    expect(postSwapFreeBalanceEthNode).toBeBigNumberEq(swapAmount);

    const expectedTokenSwapAmount = calculateExchange(swapAmount, swapRate);
    expect(postSwapFreeBalanceTokenClient).toBeBigNumberEq(expectedTokenSwapAmount);
    expect(postSwapFreeBalanceTokenNode).toBeBigNumberEq(
      preSwapFreeBalanceTokenNode.sub(expectedTokenSwapAmount.toString()),
    );

    ////////////////////////////////////////
    // TRANSFER FLOW
    // TODO: add transfer flow

    ////////////////////////////////////////
    // WITHDRAW FLOW
    // TODO: add withdraw flow
  });

  // tslint:disable-next-line:max-line-length
  test("Bot A1 tries to call a function when Bot A is offline", async () => {
    // TODO: add test
  });

  // tslint:disable-next-line:max-line-length
  test("Bot A1 tries to reject installing a proposed app that bot A has already installed?", async () => {
    // TODO: add test
  });
});
