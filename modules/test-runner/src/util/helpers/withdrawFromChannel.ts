import { IConnextClient } from "@connext/types";
import { Contract, Wallet } from "ethers";
import { AddressZero } from "ethers/constants";
import { parseEther } from "ethers/utils";
import tokenAbi from "human-standard-token-abi";

import { ethProvider } from "../ethprovider";

export const withdrawFromChannel = async (
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