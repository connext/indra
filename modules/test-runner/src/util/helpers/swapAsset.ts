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

  const preSwap: ExistingBalancesSwap = {
    freeBalanceClientEth: ethToToken ? input.amount : Zero,
    freeBalanceNodeEth: ethToToken ? Zero : output.amount,
    // tslint:disable-next-line:object-literal-sort-keys
    freeBalanceClientToken: ethToToken ? output.amount : Zero,
    freeBalanceNodeToken: ethToToken ? Zero : input.amount,
    ...preExistingBalances,
  };

  const {
    [client.freeBalanceAddress]: preSwapFreeBalanceClientEth,
    [nodeFreeBalanceAddress]: preSwapFreeBalanceNodeEth,
  } = await client.getFreeBalance(ethAssetId);
  expect(preSwapFreeBalanceClientEth).toBeBigNumberEq(preSwap.freeBalanceClientEth);
  expect(preSwapFreeBalanceNodeEth).toBeBigNumberEq(preSwap.freeBalanceNodeEth);

  const {
    [client.freeBalanceAddress]: preSwapFreeBalanceClientToken,
    [nodeFreeBalanceAddress]: preSwapFreeBalanceNodeToken,
  } = await client.getFreeBalance(tokenAssetId);
  expect(preSwapFreeBalanceClientToken).toBeBigNumberEq(preSwap.freeBalanceClientToken);
  expect(preSwapFreeBalanceNodeToken).toBeBigNumberEq(preSwap.freeBalanceNodeToken);

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

  const postSwap: ExistingBalancesSwap = {
    freeBalanceClientEth: postSwapFreeBalanceClientEth,
    freeBalanceNodeEth: postSwapFreeBalanceNodeEth,
    // tslint:disable-next-line:object-literal-sort-keys
    freeBalanceClientToken: postSwapFreeBalanceClientToken,
    freeBalanceNodeToken: postSwapFreeBalanceNodeToken,
  };

  return postSwap;
}
