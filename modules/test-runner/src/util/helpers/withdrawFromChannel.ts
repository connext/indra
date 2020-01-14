import { IConnextClient } from "@connext/types";
import { Contract, Wallet } from "ethers";
import { AddressZero } from "ethers/constants";
import tokenAbi from "human-standard-token-abi";

import { ethProvider } from "../ethprovider";

export const withdrawFromChannel = async (
  client: IConnextClient,
  amount: string,
  assetId: string,
  userSubmitted: boolean = false,
  recipient: string = Wallet.createRandom().address,
): Promise<void> => {
  // try to withdraw
  const preWithdrawalBalance = await client.getFreeBalance(assetId);
  const expected = preWithdrawalBalance[client.freeBalanceAddress].sub(amount);
  await client.withdraw({
    amount,
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
  expect(recipientBalance).toBeBigNumberEq(amount);
  expect(postWithdrawalBalance[client.freeBalanceAddress]).toBeBigNumberEq(expected);
  return;
};
