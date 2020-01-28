import { IConnextClient, SwapParameters } from "@connext/types";
import { AddressZero, Zero } from "ethers/constants";

import { expect } from "../";
import { calculateExchange, inverse } from "../bn";
import { AssetOptions, ExistingBalancesSwap } from "../types";

export async function swapAsset(
  client: IConnextClient,
  input: AssetOptions,
  output: AssetOptions,
  nodeFreeBalanceAddress: string,
  preExistingBalances?: Partial<ExistingBalancesSwap>,
): Promise<ExistingBalancesSwap> {
  const ethToToken = input.assetId === AddressZero;
  const ethAssetId = ethToToken ? input.assetId : output.assetId;
  const tokenAssetId = ethToToken ? output.assetId : input.assetId;

  const preSwap: ExistingBalancesSwap = {
    freeBalanceClientEth: ethToToken ? input.amount : Zero,
    freeBalanceNodeEth: ethToToken ? Zero : output.amount,
    freeBalanceClientToken: ethToToken ? Zero : input.amount,
    freeBalanceNodeToken: ethToToken ? output.amount : Zero,
    ...preExistingBalances,
  };

  const {
    [client.freeBalanceAddress]: preSwapFreeBalanceClientEth,
    [nodeFreeBalanceAddress]: preSwapFreeBalanceNodeEth,
  } = await client.getFreeBalance(ethAssetId);
  expect(preSwapFreeBalanceClientEth).to.be.eq(preSwap.freeBalanceClientEth);
  expect(preSwapFreeBalanceNodeEth).to.be.eq(preSwap.freeBalanceNodeEth);

  const {
    [client.freeBalanceAddress]: preSwapFreeBalanceClientToken,
    [nodeFreeBalanceAddress]: preSwapFreeBalanceNodeToken,
  } = await client.getFreeBalance(tokenAssetId);
  expect(preSwapFreeBalanceClientToken).to.be.eq(preSwap.freeBalanceClientToken);
  expect(preSwapFreeBalanceNodeToken).to.be.above(0);

  const rate = await client.getLatestSwapRate(ethAssetId, tokenAssetId);
  const swapRate = ethToToken ? rate : inverse(rate);

  const inputSwapAmount = input.amount;
  const swapParams: SwapParameters = {
    amount: inputSwapAmount.toString(),
    fromAssetId: input.assetId,
    swapRate,
    toAssetId: output.assetId,
  };
  await client.swap(swapParams);

  const expectedOutputSwapAmount = calculateExchange(inputSwapAmount, swapRate);

  const {
    [client.freeBalanceAddress]: postSwapFreeBalanceClientEth,
    [nodeFreeBalanceAddress]: postSwapFreeBalanceNodeEth,
  } = await client.getFreeBalance(ethAssetId);
  expect(postSwapFreeBalanceClientEth).to.be.eq(
    ethToToken
      ? preSwapFreeBalanceClientEth.sub(inputSwapAmount)
      : preSwapFreeBalanceClientEth.add(expectedOutputSwapAmount),
  );
  expect(postSwapFreeBalanceNodeEth).to.be.eq(
    ethToToken
      ? preSwapFreeBalanceNodeEth.add(inputSwapAmount)
      : preSwapFreeBalanceNodeEth.sub(expectedOutputSwapAmount),
  );

  const {
    [client.freeBalanceAddress]: postSwapFreeBalanceClientToken,
    [nodeFreeBalanceAddress]: postSwapFreeBalanceNodeToken,
  } = await client.getFreeBalance(tokenAssetId);
  expect(postSwapFreeBalanceClientToken).to.be.eq(
    ethToToken
      ? preSwapFreeBalanceClientToken.add(expectedOutputSwapAmount)
      : preSwapFreeBalanceClientToken.sub(inputSwapAmount),
  );
  expect(postSwapFreeBalanceNodeToken).to.be.eq(
    ethToToken
      ? preSwapFreeBalanceNodeToken.sub(expectedOutputSwapAmount)
      : preSwapFreeBalanceNodeToken.add(inputSwapAmount),
  );

  const postSwap: ExistingBalancesSwap = {
    freeBalanceClientEth: postSwapFreeBalanceClientEth,
    freeBalanceNodeEth: postSwapFreeBalanceNodeEth,
    freeBalanceClientToken: postSwapFreeBalanceClientToken,
    freeBalanceNodeToken: postSwapFreeBalanceNodeToken,
  };

  return postSwap;
}
