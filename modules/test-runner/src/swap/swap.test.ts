import { xkeyKthAddress } from "@connext/cf-core";
import { IConnextClient, SwapParameters } from "@connext/types";
import { AddressZero, Zero } from "ethers/constants";
import { BigNumber, parseEther } from "ethers/utils";

import {
  calculateExchange,
  createClient,
  inverse,
  TEST_ETH_AMOUNT,
  TEST_ETH_AMOUNT_ALT,
  TEST_TOKEN_AMOUNT,
  WRONG_ADDRESS,
  ZERO_TWO,
  ZERO_ZERO_FIVE,
} from "../util";

describe("Swaps", () => {
  let clientA: IConnextClient;
  let ethAmount: BigNumber;
  let ethAmountAlt: BigNumber;
  let tokenAmount: BigNumber;
  let tokenAddress: string;
  let nodeFreeBalanceAddress: string;
  let nodePublicIdentifier: string;

  beforeEach(async () => {
    clientA = await createClient();
    ethAmount = TEST_ETH_AMOUNT;
    ethAmountAlt = TEST_ETH_AMOUNT_ALT;
    tokenAmount = TEST_TOKEN_AMOUNT;
    tokenAddress = clientA.config.contractAddresses.Token;
    nodePublicIdentifier = clientA.config.nodePublicIdentifier;
    nodeFreeBalanceAddress = xkeyKthAddress(nodePublicIdentifier);
  }, 90_000);

  test("happy case: client swaps eth for tokens successfully", async () => {
    // client deposit and request node collateral
    await clientA.deposit({ amount: ethAmount.toString(), assetId: AddressZero });
    await clientA.requestCollateral(tokenAddress);

    // check balances pre
    const {
      [clientA.freeBalanceAddress]: preSwapFreeBalanceEthClient,
      [nodeFreeBalanceAddress]: preSwapFreeBalanceEthNode,
    } = await clientA.getFreeBalance(AddressZero);
    expect(preSwapFreeBalanceEthClient).toBeBigNumberEq(ethAmount);
    expect(preSwapFreeBalanceEthNode).toBeBigNumberEq(Zero);

    const {
      [clientA.freeBalanceAddress]: preSwapFreeBalanceTokenClient,
      [nodeFreeBalanceAddress]: preSwapFreeBalanceTokenNode,
    } = await clientA.getFreeBalance(tokenAddress);
    expect(preSwapFreeBalanceTokenNode).toBeBigNumberEq(tokenAmount);
    expect(preSwapFreeBalanceTokenClient).toBeBigNumberEq(Zero);

    const swapRate = await clientA.getLatestSwapRate(AddressZero, tokenAddress);

    const swapAmount = ethAmount;
    const swapParams: SwapParameters = {
      amount: swapAmount.toString(),
      fromAssetId: AddressZero,
      swapRate,
      toAssetId: tokenAddress,
    };
    await clientA.swap(swapParams);

    const {
      [clientA.freeBalanceAddress]: postSwapFreeBalanceEthClient,
      [nodeFreeBalanceAddress]: postSwapFreeBalanceEthNode,
    } = await clientA.getFreeBalance(AddressZero);
    const {
      [clientA.freeBalanceAddress]: postSwapFreeBalanceTokenClient,
      [nodeFreeBalanceAddress]: postSwapFreeBalanceTokenNode,
    } = await clientA.getFreeBalance(tokenAddress);

    expect(postSwapFreeBalanceEthClient).toBeBigNumberEq(
      preSwapFreeBalanceEthClient.sub(swapAmount),
    );
    expect(postSwapFreeBalanceEthNode).toBeBigNumberEq(swapAmount);

    const expectedTokenSwapAmount = calculateExchange(swapAmount, swapRate);
    expect(postSwapFreeBalanceTokenClient).toBeBigNumberEq(expectedTokenSwapAmount);
    expect(postSwapFreeBalanceTokenNode).toBeBigNumberEq(
      preSwapFreeBalanceTokenNode.sub(expectedTokenSwapAmount.toString()),
    );
  });

  test("happy case: client swaps tokens for eth successfully", async () => {
    // client deposit and request node collateral
    await clientA.deposit({ amount: tokenAmount.toString(), assetId: tokenAddress });
    await clientA.requestCollateral(AddressZero);

    // check balances pre
    const {
      [clientA.freeBalanceAddress]: preSwapFreeBalanceEthClient,
      [nodeFreeBalanceAddress]: preSwapFreeBalanceEthNode,
    } = await clientA.getFreeBalance(AddressZero);
    expect(preSwapFreeBalanceEthClient).toBeBigNumberEq(Zero);
    expect(preSwapFreeBalanceEthNode).toBeBigNumberEq(ethAmountAlt);

    const {
      [clientA.freeBalanceAddress]: preSwapFreeBalanceTokenClient,
      [nodeFreeBalanceAddress]: preSwapFreeBalanceTokenNode,
    } = await clientA.getFreeBalance(tokenAddress);
    expect(preSwapFreeBalanceTokenNode).toBeBigNumberEq(Zero);
    expect(preSwapFreeBalanceTokenClient).toBeBigNumberEq(tokenAmount);

    const swapRate = await clientA.getLatestSwapRate(AddressZero, tokenAddress);
    const inverseSwapRate = inverse(swapRate);
    console.log("inverseSwapRate: ", inverseSwapRate);

    const swapAmount = tokenAmount;
    console.log("swapAmount: ", swapAmount);
    const swapParams: SwapParameters = {
      amount: swapAmount.toString(),
      fromAssetId: tokenAddress,
      swapRate: inverseSwapRate,
      toAssetId: AddressZero,
    };
    await clientA.swap(swapParams);

    const {
      [clientA.freeBalanceAddress]: postSwapFreeBalanceEthClient,
      [nodeFreeBalanceAddress]: postSwapFreeBalanceEthNode,
    } = await clientA.getFreeBalance(AddressZero);
    const {
      [clientA.freeBalanceAddress]: postSwapFreeBalanceTokenClient,
      [nodeFreeBalanceAddress]: postSwapFreeBalanceTokenNode,
    } = await clientA.getFreeBalance(tokenAddress);

    const expectedEthSwapAmount = calculateExchange(swapAmount, inverseSwapRate);
    expect(postSwapFreeBalanceEthClient).toBeBigNumberEq(expectedEthSwapAmount);
    expect(postSwapFreeBalanceEthNode).toBeBigNumberEq(
      preSwapFreeBalanceEthNode.sub(expectedEthSwapAmount),
    );

    expect(postSwapFreeBalanceTokenClient).toBeBigNumberEq(
      preSwapFreeBalanceTokenClient.sub(swapAmount),
    );
    expect(postSwapFreeBalanceTokenNode).toBeBigNumberEq(swapAmount);
  });

  test("Bot A tries to swap with invalid from token address", async () => {
    // client deposit and request node collateral
    await clientA.deposit({ amount: ethAmount.toString(), assetId: AddressZero });
    await clientA.requestCollateral(tokenAddress);

    const swapRate = await clientA.getLatestSwapRate(AddressZero, tokenAddress);
    const swapAmount = parseEther(ZERO_ZERO_FIVE);
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
    await clientA.deposit({ amount: ethAmount.toString(), assetId: AddressZero });
    await clientA.requestCollateral(tokenAddress);

    const swapRate = await clientA.getLatestSwapRate(AddressZero, tokenAddress);
    const swapAmount = parseEther(ZERO_ZERO_FIVE);
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
    await clientA.deposit({ amount: ethAmount.toString(), assetId: AddressZero });
    await clientA.requestCollateral(tokenAddress);

    const swapRate = await clientA.getLatestSwapRate(AddressZero, tokenAddress);
    const swapAmount = parseEther(ZERO_TWO);
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
    await clientA.deposit({ amount: ethAmount.toString(), assetId: AddressZero });
    await clientA.requestCollateral(tokenAddress);

    const swapRate = await clientA.getLatestSwapRate(AddressZero, tokenAddress);
    const swapAmount = parseEther(ZERO_ZERO_FIVE);
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
    await clientA.deposit({ amount: ethAmount.toString(), assetId: AddressZero });
    await clientA.requestCollateral(tokenAddress);

    const swapRate = await clientA.getLatestSwapRate(AddressZero, tokenAddress);
    const swapAmount = parseEther(ZERO_ZERO_FIVE);
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
    await clientA.deposit({ amount: ethAmount.toString(), assetId: AddressZero });
    // No collateral requested

    const swapRate = await clientA.getLatestSwapRate(AddressZero, tokenAddress);
    const swapAmount = parseEther(ZERO_ZERO_FIVE);
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
    await clientA.deposit({ amount: ethAmount.toString(), assetId: AddressZero });
    await clientA.requestCollateral(tokenAddress);
    // No collateral requested

    const swapRate = "1";
    const swapAmount = parseEther(ZERO_ZERO_FIVE);
    const swapParams: SwapParameters = {
      amount: swapAmount.toString(),
      fromAssetId: AddressZero,
      swapRate,
      toAssetId: tokenAddress,
    };
    await expect(clientA.swap(swapParams)).rejects.toThrowError(`is jiaji greater than 0`);
  });
});
