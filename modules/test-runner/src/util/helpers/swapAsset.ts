import { IConnextClient, PublicParams } from "@connext/types";
import { calculateExchange, getAddressFromAssetId, inverse } from "@connext/utils";
import { constants } from "ethers";

import { expect } from "../";
import { AssetOptions, ExistingBalancesSwap } from "../types";

const { AddressZero, Zero } = constants;

export async function swapAsset(
  client: IConnextClient,
  input: AssetOptions,
  output: AssetOptions,
  nodeSignerAddress: string,
  preExistingBalances?: Partial<ExistingBalancesSwap>,
  resultingBalances?: Partial<ExistingBalancesSwap>,
): Promise<ExistingBalancesSwap> {
  const ethToToken = getAddressFromAssetId(input.assetId) === AddressZero;
  const ethAssetId = ethToToken ? input.assetId : output.assetId;
  const tokenAssetId = ethToToken ? output.assetId : input.assetId;
  const ethAddress = getAddressFromAssetId(ethAssetId);
  const tokenAddress = getAddressFromAssetId(tokenAssetId);

  const preSwap: ExistingBalancesSwap = {
    freeBalanceClientEth: ethToToken ? input.amount : Zero,
    freeBalanceClientToken: ethToToken ? Zero : input.amount,
    freeBalanceNodeEth: ethToToken ? Zero : output.amount,
    freeBalanceNodeToken: ethToToken ? output.amount : Zero,
    ...preExistingBalances,
  };

  const {
    [client.signerAddress]: preSwapFreeBalanceClientEth,
    [nodeSignerAddress]: preSwapFreeBalanceNodeEth,
  } = await client.getFreeBalance(ethAssetId);
  expect(preSwapFreeBalanceClientEth).to.be.eq(preSwap.freeBalanceClientEth);

  const {
    [client.signerAddress]: preSwapFreeBalanceClientToken,
    [nodeSignerAddress]: preSwapFreeBalanceNodeToken,
  } = await client.getFreeBalance(tokenAssetId);
  expect(preSwapFreeBalanceClientToken).to.be.eq(preSwap.freeBalanceClientToken);

  const rate = await client.getLatestSwapRate(ethAddress, tokenAddress);
  const swapRate = ethToToken ? rate : inverse(rate);

  const inputSwapAmount = input.amount;
  const swapParams: PublicParams.Swap = {
    amount: inputSwapAmount.toString(),
    fromAssetId: getAddressFromAssetId(input.assetId),
    swapRate,
    toAssetId: getAddressFromAssetId(output.assetId),
  };
  await client.swap(swapParams);

  const expectedOutputSwapAmount = calculateExchange(inputSwapAmount, swapRate);
  const {
    [client.signerAddress]: postSwapFreeBalanceClientEth,
    [nodeSignerAddress]: postSwapFreeBalanceNodeEth,
  } = await client.getFreeBalance(ethAddress);
  const {
    [client.signerAddress]: postSwapFreeBalanceClientToken,
    [nodeSignerAddress]: postSwapFreeBalanceNodeToken,
  } = await client.getFreeBalance(tokenAddress);

  const postSwap: ExistingBalancesSwap = {
    freeBalanceClientEth: ethToToken
      ? preSwapFreeBalanceClientEth.sub(inputSwapAmount)
      : preSwapFreeBalanceClientEth.add(expectedOutputSwapAmount),
    freeBalanceNodeEth: ethToToken
      ? preSwapFreeBalanceNodeEth.add(inputSwapAmount)
      : preSwapFreeBalanceNodeEth.sub(expectedOutputSwapAmount),
    freeBalanceClientToken: ethToToken
      ? preSwapFreeBalanceClientToken.add(expectedOutputSwapAmount)
      : preSwapFreeBalanceClientToken.sub(inputSwapAmount),
    freeBalanceNodeToken: ethToToken
      ? preSwapFreeBalanceNodeToken.sub(expectedOutputSwapAmount)
      : preSwapFreeBalanceNodeToken.add(inputSwapAmount),
    ...resultingBalances,
  };

  expect(postSwapFreeBalanceClientEth).to.be.eq(postSwap.freeBalanceClientEth);
  expect(postSwapFreeBalanceNodeEth).to.be.at.least(postSwap.freeBalanceNodeEth);
  expect(postSwapFreeBalanceClientToken).to.be.eq(postSwap.freeBalanceClientToken);
  expect(postSwapFreeBalanceNodeToken).to.be.at.least(postSwap.freeBalanceNodeToken);

  return postSwap;
}
