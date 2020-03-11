import { IConnextClient } from "@connext/types";
import { Contract, Wallet } from "ethers";
import { AddressZero } from "ethers/constants";
import { BigNumber } from "ethers/utils";
import tokenAbi from "human-standard-token-abi";

import { env } from "../env";
import { Logger } from "../logger";
import { expect } from "../";
import { ethProvider } from "../ethprovider";

export const withdrawFromChannel = async (
  client: IConnextClient,
  amount: BigNumber,
  assetId: string,
  userSubmitted: boolean = false,
  recipient: string = Wallet.createRandom().address,
): Promise<void> => {
  // try to withdraw
  const preWithdrawalBalance = await client.getFreeBalance(assetId);
  const expected = preWithdrawalBalance[client.freeBalanceAddress].sub(amount);
  const log = new Logger("WithdrawFromChannel", env.logLevel);
  log.info(`client.withdraw() called`);
  const start = Date.now();
  await client.withdraw({
    amount: amount.toString(),
    assetId,
    recipient,
    userSubmitted,
  });
  log.info(`client.withdraw() returned in ${Date.now() - start}ms`);
  const postWithdrawalBalance = await client.getFreeBalance(assetId);
  let recipientBalance;
  if (assetId === AddressZero) {
    recipientBalance = await ethProvider.getBalance(recipient);
  } else {
    const token = new Contract(client.config.contractAddresses.Token, tokenAbi, ethProvider);
    recipientBalance = await token.balanceOf(recipient);
  }
  expect(recipientBalance.toString()).to.be.eq(amount.toString());
  expect(postWithdrawalBalance[client.freeBalanceAddress].toString()).to.be.eq(expected.toString());
  return;
};
