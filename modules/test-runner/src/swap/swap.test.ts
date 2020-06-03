import { IConnextClient, PublicParams } from "@connext/types";
import { constants, utils } from "ethers";

import { expect, ONE_ETH } from "../util";
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

const { AddressZero } = constants;
const { parseEther } = utils;

describe("Swaps", () => {
  let client: IConnextClient;
  let tokenAddress: string;
  let nodeSignerAddress: string;

  beforeEach(async () => {
    client = await createClient();
    tokenAddress = client.config.contractAddresses.Token!;
    nodeSignerAddress = client.nodeSignerAddress;
  });

  afterEach(async () => {
    await client.messaging.disconnect();
  });

  it("happy case: client swaps eth for tokens successfully", async () => {
    const input: AssetOptions = { amount: ETH_AMOUNT_SM, assetId: AddressZero };
    const output: AssetOptions = { amount: TOKEN_AMOUNT, assetId: tokenAddress };
    await fundChannel(client, input.amount, input.assetId);
    await client.requestCollateral(output.assetId);
    await swapAsset(client, input, output, nodeSignerAddress);
  });

  it("happy case: client swaps tokens for eth successfully", async () => {
    const input: AssetOptions = { amount: ONE_ETH, assetId: tokenAddress };
    const output: AssetOptions = { amount: ETH_AMOUNT_MD, assetId: AddressZero };
    await fundChannel(client, input.amount, input.assetId);
    await client.requestCollateral(output.assetId);
    await swapAsset(client, input, output, nodeSignerAddress);
  });

  it("happy case: client tries to swap with insufficient collateral on node", async () => {
    const input: AssetOptions = { amount: ETH_AMOUNT_SM, assetId: AddressZero };
    const output: AssetOptions = { amount: TOKEN_AMOUNT, assetId: tokenAddress };
    await fundChannel(client, input.amount, input.assetId);
    await swapAsset(client, input, output, nodeSignerAddress);
  });

  it("client tries to swap with invalid from token address", async () => {
    await fundChannel(client, ETH_AMOUNT_SM, AddressZero);
    await client.requestCollateral(tokenAddress);
    const swapRate = await client.getLatestSwapRate(AddressZero, tokenAddress);
    const swapAmount = parseEther(ZERO_ZERO_ZERO_FIVE);
    const swapParams: PublicParams.Swap = {
      amount: swapAmount.toString(),
      fromAssetId: WRONG_ADDRESS,
      swapRate,
      toAssetId: tokenAddress,
    };
    await expect(client.swap(swapParams)).to.be.rejectedWith("invalid address");
  });

  it("client tries to swap with invalid to token address", async () => {
    await fundChannel(client, ETH_AMOUNT_SM, AddressZero);
    await client.requestCollateral(tokenAddress);
    const swapRate = await client.getLatestSwapRate(AddressZero, tokenAddress);
    const swapAmount = parseEther(ZERO_ZERO_ZERO_FIVE);
    const swapParams: PublicParams.Swap = {
      amount: swapAmount.toString(),
      fromAssetId: AddressZero,
      swapRate,
      toAssetId: WRONG_ADDRESS,
    };
    await expect(client.swap(swapParams)).to.be.rejectedWith("invalid address");
  });

  it("client tries to swap with insufficient free balance for the user", async () => {
    await fundChannel(client, ETH_AMOUNT_SM, AddressZero);
    await client.requestCollateral(tokenAddress);
    const swapRate = await client.getLatestSwapRate(AddressZero, tokenAddress);
    const swapAmount = parseEther(ZERO_ZERO_TWO);
    const swapParams: PublicParams.Swap = {
      amount: swapAmount.toString(),
      fromAssetId: AddressZero,
      swapRate,
      toAssetId: tokenAddress,
    };
    await expect(client.swap(swapParams)).to.be.rejectedWith("is not less than or equal to");
  });

  it("client tries to swap with negative swap rate", async () => {
    await fundChannel(client, ETH_AMOUNT_SM, AddressZero);
    await client.requestCollateral(tokenAddress);
    const swapRate = await client.getLatestSwapRate(AddressZero, tokenAddress);
    const swapAmount = parseEther(ZERO_ZERO_ZERO_FIVE);
    const swapParams: PublicParams.Swap = {
      amount: swapAmount.toString(),
      fromAssetId: AddressZero,
      swapRate: (-swapRate).toString(),
      toAssetId: tokenAddress,
    };
    await expect(client.swap(swapParams)).to.be.rejectedWith("is not greater than or equal to 0");
  });

  it("client tries to swap with negative user amount", async () => {
    await fundChannel(client, ETH_AMOUNT_SM, AddressZero);
    await client.requestCollateral(tokenAddress);
    const swapRate = await client.getLatestSwapRate(AddressZero, tokenAddress);
    const swapAmount = parseEther(ZERO_ZERO_ZERO_FIVE);
    const swapParams: PublicParams.Swap = {
      amount: swapAmount.mul(-1).toString(),
      fromAssetId: AddressZero,
      swapRate,
      toAssetId: tokenAddress,
    };
    await expect(client.swap(swapParams)).to.be.rejectedWith("is not greater than 0");
  });

  // TODO: this passes locally when running `make test-integration, and when
  // running `make pull-commit && make start-test-integration but is failing
  // in CD (with the same instructions). See:
  // https://github.com/ConnextProject/indra/issues/807
  it.skip("client tries to swap with incorrect swap rate (node rejects)", async () => {
    await fundChannel(client, ETH_AMOUNT_SM, AddressZero);
    await client.requestCollateral(tokenAddress);
    // No collateral requested
    const swapRate = ONE;
    const swapAmount = parseEther(ZERO_ZERO_ZERO_FIVE);
    const swapParams: PublicParams.Swap = {
      amount: swapAmount.toString(),
      fromAssetId: AddressZero,
      swapRate,
      toAssetId: tokenAddress,
    };
    await expect(client.swap(swapParams)).to.be.rejectedWith("Error: Install failed");
  });
});
