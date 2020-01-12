import { IConnextClient, SwapParameters } from "@connext/types";
import { AddressZero, Zero } from "ethers/constants";
import { BigNumber } from "ethers/utils";

import { calculateExchange, inverse } from "../bn";
import { ExistingBalances } from "../types";

interface AssetOptions {
  amount: BigNumber;
  assetId: string;
}

function isEth(assetId: string) {
  return assetId === AddressZero;
}

export async function swapAsset(
  client: IConnextClient,
  input: AssetOptions,
  output: AssetOptions,
  nodeFreeBalanceAddress: string,
  preExistingBalances?: Partial<ExistingBalances>,
): Promise<void> {
  const ethToToken = isEth(input.assetId);
  if (ethToToken) {
    const existingBalances = {
      freeBalanceClientA: input.amount,
      freeBalanceClientB: Zero,
      freeBalanceNodeA: Zero,
      freeBalanceNodeB: output.amount,
      ...preExistingBalances,
    };

    // check balances pre
    const {
      [client.freeBalanceAddress]: preSwapFreeBalanceEthClient,
      [nodeFreeBalanceAddress]: preSwapFreeBalanceEthNode,
    } = await client.getFreeBalance(input.assetId);
    expect(preSwapFreeBalanceEthClient).toBeBigNumberEq(input.amount);
    expect(preSwapFreeBalanceEthNode).toBeBigNumberEq(Zero);

    const {
      [client.freeBalanceAddress]: preSwapFreeBalanceTokenClient,
      [nodeFreeBalanceAddress]: preSwapFreeBalanceTokenNode,
    } = await client.getFreeBalance(output.assetId);
    expect(preSwapFreeBalanceTokenNode).toBeBigNumberEq(output.amount);
    expect(preSwapFreeBalanceTokenClient).toBeBigNumberEq(Zero);

    const rate = await client.getLatestSwapRate(input.assetId, output.assetId);
    const swapRate = rate;

    const swapAmount = input.amount;
    const swapParams: SwapParameters = {
      amount: swapAmount.toString(),
      fromAssetId: input.assetId,
      swapRate,
      toAssetId: output.assetId,
    };
    await client.swap(swapParams);

    const expectedTokenSwapAmount = calculateExchange(swapAmount, swapRate);

    const {
      [client.freeBalanceAddress]: postSwapFreeBalanceEthClient,
      [nodeFreeBalanceAddress]: postSwapFreeBalanceEthNode,
    } = await client.getFreeBalance(input.assetId);
    expect(postSwapFreeBalanceEthClient).toBeBigNumberEq(
      preSwapFreeBalanceEthClient.sub(swapAmount),
    );
    expect(postSwapFreeBalanceEthNode).toBeBigNumberEq(swapAmount);

    const {
      [client.freeBalanceAddress]: postSwapFreeBalanceTokenClient,
      [nodeFreeBalanceAddress]: postSwapFreeBalanceTokenNode,
    } = await client.getFreeBalance(output.assetId);
    expect(postSwapFreeBalanceTokenClient).toBeBigNumberEq(expectedTokenSwapAmount);
    expect(postSwapFreeBalanceTokenNode).toBeBigNumberEq(
      preSwapFreeBalanceTokenNode.sub(expectedTokenSwapAmount),
    );
  } else {
    const existingBalances = {
      freeBalanceClientA: Zero,
      freeBalanceClientB: output.amount,
      freeBalanceNodeA: Zero,
      freeBalanceNodeB: input.amount,
      ...preExistingBalances,
    };

    // check balances pre
    const {
      [client.freeBalanceAddress]: preSwapFreeBalanceEthClient,
      [nodeFreeBalanceAddress]: preSwapFreeBalanceEthNode,
    } = await client.getFreeBalance(output.assetId);
    expect(preSwapFreeBalanceEthClient).toBeBigNumberEq(Zero);
    expect(preSwapFreeBalanceEthNode).toBeBigNumberEq(output.amount);

    const {
      [client.freeBalanceAddress]: preSwapFreeBalanceTokenClient,
      [nodeFreeBalanceAddress]: preSwapFreeBalanceTokenNode,
    } = await client.getFreeBalance(input.assetId);
    expect(preSwapFreeBalanceTokenNode).toBeBigNumberEq(Zero);
    expect(preSwapFreeBalanceTokenClient).toBeBigNumberEq(input.amount);

    const rate = await client.getLatestSwapRate(output.assetId, input.assetId);
    const swapRate = inverse(rate);
    console.log("swapRate: ", swapRate);

    const swapAmount = input.amount;
    console.log("swapAmount: ", swapAmount);
    const swapParams: SwapParameters = {
      amount: swapAmount.toString(),
      fromAssetId: input.assetId,
      swapRate,
      toAssetId: output.assetId,
    };
    await client.swap(swapParams);

    const expectedEthSwapAmount = calculateExchange(swapAmount, swapRate);

    const {
      [client.freeBalanceAddress]: postSwapFreeBalanceEthClient,
      [nodeFreeBalanceAddress]: postSwapFreeBalanceEthNode,
    } = await client.getFreeBalance(output.assetId);
    expect(postSwapFreeBalanceEthClient).toBeBigNumberEq(expectedEthSwapAmount);
    expect(postSwapFreeBalanceEthNode).toBeBigNumberEq(
      preSwapFreeBalanceEthNode.sub(expectedEthSwapAmount),
    );

    const {
      [client.freeBalanceAddress]: postSwapFreeBalanceTokenClient,
      [nodeFreeBalanceAddress]: postSwapFreeBalanceTokenNode,
    } = await client.getFreeBalance(input.assetId);
    expect(postSwapFreeBalanceTokenClient).toBeBigNumberEq(
      preSwapFreeBalanceTokenClient.sub(swapAmount),
    );
    expect(postSwapFreeBalanceTokenNode).toBeBigNumberEq(swapAmount);
  }
}
