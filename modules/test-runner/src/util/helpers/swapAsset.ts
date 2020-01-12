import { IConnextClient, SwapParameters } from "@connext/types";
import { AddressZero, Zero } from "ethers/constants";

import { calculateExchange, inverse } from "../bn";
import { ExistingBalancesSwap, SwapAssetOptions } from "../types";

export async function swapAsset(
  client: IConnextClient,
  input: SwapAssetOptions,
  output: SwapAssetOptions,
  nodeFreeBalanceAddress: string,
  preExistingBalances?: Partial<ExistingBalancesSwap>,
): Promise<ExistingBalancesSwap> {
  const ethToToken = input.assetId === AddressZero;
  const ethAssetId = ethToToken ? input.assetId : output.assetId;
  const tokenAssetId = ethToToken ? output.assetId : input.assetId;

  const pre: ExistingBalancesSwap = {
    freeBalanceClientEth: ethToToken ? input.amount : Zero,
    freeBalanceClientToken: ethToToken ? Zero : input.amount,
    freeBalanceNodeEth: ethToToken ? Zero : output.amount,
    freeBalanceNodeToken: ethToToken ? output.amount : Zero,
    ...preExistingBalances,
  };

  // check balances pre
  const {
    [client.freeBalanceAddress]: preSwapFreeBalanceClientEth,
    [nodeFreeBalanceAddress]: preSwapFreeBalanceNodeEth,
  } = await client.getFreeBalance(ethAssetId);
  expect(preSwapFreeBalanceClientEth).toBeBigNumberEq(pre.freeBalanceClientEth);
  expect(preSwapFreeBalanceNodeEth).toBeBigNumberEq(pre.freeBalanceNodeEth);

  const {
    [client.freeBalanceAddress]: preSwapFreeBalanceClientToken,
    [nodeFreeBalanceAddress]: preSwapFreeBalanceNodeToken,
  } = await client.getFreeBalance(tokenAssetId);
  expect(preSwapFreeBalanceNodeToken).toBeBigNumberEq(pre.freeBalanceNodeToken);
  expect(preSwapFreeBalanceClientToken).toBeBigNumberEq(pre.freeBalanceClientToken);

  const rate = await client.getLatestSwapRate(ethAssetId, tokenAssetId);
  const swapRate = ethToToken ? rate : inverse(rate);

  const swapAmount = input.amount;
  const swapParams: SwapParameters = {
    amount: swapAmount.toString(),
    fromAssetId: input.assetId,
    swapRate,
    toAssetId: output.assetId,
  };
  await client.swap(swapParams);

  const expectedSwapAmount = calculateExchange(swapAmount, swapRate);

  const {
    [client.freeBalanceAddress]: postSwapFreeBalanceClientEth,
    [nodeFreeBalanceAddress]: postSwapFreeBalanceNodeEth,
  } = await client.getFreeBalance(ethAssetId);
  expect(postSwapFreeBalanceClientEth).toBeBigNumberEq(
    ethToToken
      ? preSwapFreeBalanceClientEth.sub(expectedSwapAmount)
      : preSwapFreeBalanceClientEth.add(expectedSwapAmount),
  );
  expect(postSwapFreeBalanceNodeEth).toBeBigNumberEq(
    ethToToken
      ? preSwapFreeBalanceNodeEth.add(expectedSwapAmount)
      : preSwapFreeBalanceNodeEth.sub(expectedSwapAmount),
  );

  const {
    [client.freeBalanceAddress]: postSwapFreeBalanceClientToken,
    [nodeFreeBalanceAddress]: postSwapFreeBalanceNodeToken,
  } = await client.getFreeBalance(tokenAssetId);
  expect(postSwapFreeBalanceClientToken).toBeBigNumberEq(
    ethToToken
      ? preSwapFreeBalanceClientToken.add(expectedSwapAmount)
      : preSwapFreeBalanceClientToken.sub(expectedSwapAmount),
  );
  expect(postSwapFreeBalanceNodeToken).toBeBigNumberEq(
    ethToToken
      ? preSwapFreeBalanceNodeToken.sub(expectedSwapAmount)
      : preSwapFreeBalanceNodeToken.add(expectedSwapAmount),
  );
  return {
    freeBalanceClientEth: postSwapFreeBalanceClientEth,
    freeBalanceClientToken: postSwapFreeBalanceClientToken,
    freeBalanceNodeEth: postSwapFreeBalanceNodeEth,
    freeBalanceNodeToken: postSwapFreeBalanceNodeToken,
  };
}
