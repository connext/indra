import { xkeyKthAddress } from "@connext/cf-core";
import { IConnextClient, SwapParameters } from "@connext/types";
import { AddressZero } from "ethers/constants";
import { parseEther } from "ethers/utils";

import {
  AssetOptions,
  createClient,
  ETH_AMOUNT_MD,
  ETH_AMOUNT_SM,
  fundChannel,
  swapAsset,
  TOKEN_AMOUNT,
  WRONG_ADDRESS,
  ZERO_ZERO_TWO,
  ZERO_ZERO_ZERO_FIVE,
  ONE,
} from "../util";

describe("Swaps", () => {
  let clientA: IConnextClient;
  let tokenAddress: string;
  let nodeFreeBalanceAddress: string;
  let nodePublicIdentifier: string;

  beforeEach(async () => {
    clientA = await createClient();
    tokenAddress = clientA.config.contractAddresses.Token;
    nodePublicIdentifier = clientA.config.nodePublicIdentifier;
    nodeFreeBalanceAddress = xkeyKthAddress(nodePublicIdentifier);
  }, 90_000);

  test("happy case: client swaps eth for tokens successfully", async () => {
    const input: AssetOptions = { amount: ETH_AMOUNT_SM, assetId: AddressZero };
    const output: AssetOptions = { amount: TOKEN_AMOUNT, assetId: tokenAddress };
    // client deposit and request node collateral
    await fundChannel(clientA, input.amount, input.assetId);
    await clientA.requestCollateral(output.assetId);

    await swapAsset(clientA, input, output, nodeFreeBalanceAddress);
  });

  test("happy case: client swaps tokens for eth successfully", async () => {
    const input: AssetOptions = { amount: TOKEN_AMOUNT, assetId: tokenAddress };
    const output: AssetOptions = { amount: ETH_AMOUNT_MD, assetId: AddressZero };
    // client deposit and request node collateral
    await fundChannel(clientA, input.amount, input.assetId);
    await clientA.requestCollateral(output.assetId);

    await swapAsset(clientA, input, output, nodeFreeBalanceAddress);
  });

  test("Bot A tries to swap with invalid from token address", async () => {
    // client deposit and request node collateral
    await fundChannel(clientA, ETH_AMOUNT_SM, AddressZero);
    await clientA.requestCollateral(tokenAddress);

    const swapRate = await clientA.getLatestSwapRate(AddressZero, tokenAddress);
    const swapAmount = parseEther(ZERO_ZERO_ZERO_FIVE);
    const swapParams: SwapParameters = {
      amount: swapAmount.toString(),
      fromAssetId: WRONG_ADDRESS,
      swapRate,
      toAssetId: tokenAddress,
    };
    await expect(clientA.swap(swapParams)).rejects.toThrowError(`is not a valid eth address`);
  });

  test("Bot A tries to swap with invalid to token address", async () => {
    // client deposit and request node collateral
    await fundChannel(clientA, ETH_AMOUNT_SM, AddressZero);
    await clientA.requestCollateral(tokenAddress);

    const swapRate = await clientA.getLatestSwapRate(AddressZero, tokenAddress);
    const swapAmount = parseEther(ZERO_ZERO_ZERO_FIVE);
    const swapParams: SwapParameters = {
      amount: swapAmount.toString(),
      fromAssetId: AddressZero,
      swapRate,
      toAssetId: WRONG_ADDRESS,
    };
    await expect(clientA.swap(swapParams)).rejects.toThrowError(`is not a valid eth address`);
  });

  test("Bot A tries to swap with insufficient free balance for the user", async () => {
    // client deposit and request node collateral
    await fundChannel(clientA, ETH_AMOUNT_SM, AddressZero);
    await clientA.requestCollateral(tokenAddress);

    const swapRate = await clientA.getLatestSwapRate(AddressZero, tokenAddress);
    const swapAmount = parseEther(ZERO_ZERO_TWO);
    const swapParams: SwapParameters = {
      amount: swapAmount.toString(),
      fromAssetId: AddressZero,
      swapRate,
      toAssetId: tokenAddress,
    };
    await expect(clientA.swap(swapParams)).rejects.toThrowError(`is not less than or equal to`);
  });

  test("Bot A tries to swap with negative swap rate", async () => {
    // client deposit and request node collateral
    await fundChannel(clientA, ETH_AMOUNT_SM, AddressZero);
    await clientA.requestCollateral(tokenAddress);

    const swapRate = await clientA.getLatestSwapRate(AddressZero, tokenAddress);
    const swapAmount = parseEther(ZERO_ZERO_ZERO_FIVE);
    const swapParams: SwapParameters = {
      amount: swapAmount.toString(),
      fromAssetId: AddressZero,
      swapRate: (-swapRate).toString(),
      toAssetId: tokenAddress,
    };
    await expect(clientA.swap(swapParams)).rejects.toThrowError(
      `is not greater than or equal to 0`,
    );
  });

  test("Bot A tries to swap with negative user amount", async () => {
    // client deposit and request node collateral
    await fundChannel(clientA, ETH_AMOUNT_SM, AddressZero);
    await clientA.requestCollateral(tokenAddress);

    const swapRate = await clientA.getLatestSwapRate(AddressZero, tokenAddress);
    const swapAmount = parseEther(ZERO_ZERO_ZERO_FIVE);
    const swapParams: SwapParameters = {
      amount: swapAmount.mul(-1).toString(),
      fromAssetId: AddressZero,
      swapRate,
      toAssetId: tokenAddress,
    };
    await expect(clientA.swap(swapParams)).rejects.toThrowError(`is not greater than 0`);
  });

  test("Bot A tries to swap with insufficient collateral on node", async () => {
    // client deposit and request node collateral
    await fundChannel(clientA, ETH_AMOUNT_SM, AddressZero);
    // No collateral requested

    const swapRate = await clientA.getLatestSwapRate(AddressZero, tokenAddress);
    const swapAmount = parseEther(ZERO_ZERO_ZERO_FIVE);
    const swapParams: SwapParameters = {
      amount: swapAmount.toString(),
      fromAssetId: AddressZero,
      swapRate,
      toAssetId: tokenAddress,
    };
    await expect(clientA.swap(swapParams)).rejects.toThrowError(`is not less than or equal to 0`);
  });

  // TODO Currently, this test always fails because when promise is never rejected when
  //      node rejects install.
  test.skip("Bot A tries to swap with incorrect swap rate (node rejects)", async () => {
    // client deposit and request node collateral
    await fundChannel(clientA, ETH_AMOUNT_SM, AddressZero);
    await clientA.requestCollateral(tokenAddress);
    // No collateral requested

    const swapRate = ONE;
    const swapAmount = parseEther(ZERO_ZERO_ZERO_FIVE);
    const swapParams: SwapParameters = {
      amount: swapAmount.toString(),
      fromAssetId: AddressZero,
      swapRate,
      toAssetId: tokenAddress,
    };
    await expect(clientA.swap(swapParams)).rejects.toThrowError(`is jiaji greater than 0`);
  });
});
