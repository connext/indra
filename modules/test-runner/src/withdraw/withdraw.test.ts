import { IConnextClient } from "@connext/types";
import { Contract, Wallet } from "ethers";
import { AddressZero } from "ethers/constants";
import { parseEther } from "ethers/utils";
import tokenAbi from "human-standard-token-abi";

import { createClient } from "../util/client";
import { ethProvider } from "../util/ethprovider";

const fundChannel = async (
  client: IConnextClient,
  amount: string, // ETH string, only included if not collateral
  assetId: string = AddressZero,
): Promise<void> => {
  const prevFreeBalance = await client.getFreeBalance();
  await new Promise(async resolve => {
    // TODO: should add `once` to top level client
    client.on("DEPOSIT_CONFIRMED_EVENT", async () => {
      const freeBalance = await client.getFreeBalance(assetId);
      // verify free balance increased as expected
      const expected = prevFreeBalance[client.freeBalanceAddress].add(parseEther(amount));
      expect(freeBalance[client.freeBalanceAddress]).toBeBigNumberEq(expected);
      resolve();
    });

    await client.deposit({ amount: parseEther(amount).toString(), assetId });
  });

  return;
};

const withdraw = async (
  client: IConnextClient,
  amount: string, // ETH string
  assetId: string,
  userSubmitted: boolean = false,
): Promise<void> => {
  // try to withdraw
  const preWithdrawalBalance = await client.getFreeBalance(assetId);
  const wdAmt = parseEther(amount);
  const expected = preWithdrawalBalance[client.freeBalanceAddress].sub(wdAmt);
  const recipient = Wallet.createRandom().address;
  await client.withdraw({
    amount: wdAmt.toString(),
    assetId,
    recipient,
    userSubmitted,
  });
  const postWithdrawalBalance = await client.getFreeBalance(assetId);
  let recipientBalance;
  if (assetId === AddressZero) {
    recipientBalance = await ethProvider.getBalance(recipient);
  } else {
    const token = new Contract(client.config.contractAddresses.Token, tokenAbi, ethProvider);
    recipientBalance = await token.balanceOf(recipient);
  }
  expect(recipientBalance).toBeBigNumberEq(wdAmt);
  expect(postWithdrawalBalance[client.freeBalanceAddress]).toBeBigNumberEq(expected);
  return;
};

describe("Withdrawal", () => {
  let client: IConnextClient;
  let tokenAddress: string;

  beforeEach(async () => {
    client = await createClient();
    tokenAddress = client.config.contractAddresses.Token;
  }, 90_000);

  test("happy case: client successfully withdraws eth and submits the tx itself", async () => {
    // fund client with eth
    await fundChannel(client, "0.02");
    // withdraw
    await withdraw(client, "0.01", AddressZero, true);
  });

  test("happy case: client successfully withdraws tokens and submits the tx itself", async () => {
    // fund client with tokens
    await fundChannel(client, "0.02", tokenAddress);
    // withdraw
    await withdraw(client, "0.01", tokenAddress, true);
  });

  test("happy case: client successfully withdraws eth and node submits the tx", async () => {
    await fundChannel(client, "0.02");
    // withdraw
    await withdraw(client, "0.01", AddressZero);
  });

  test("happy case: client successfully withdraws tokens and node submits the tx", async () => {
    await fundChannel(client, "0.02", tokenAddress);
    // withdraw
    await withdraw(client, "0.01", tokenAddress);
  });
});
