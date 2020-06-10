import { IConnextClient } from "@connext/types";
import { ColorfulLogger } from "@connext/utils";
import { ERC20 } from "@connext/contracts";
import { BigNumber, Contract, Wallet, constants, utils } from "ethers";

import { env } from "../env";
import { expect } from "../";
import { ethProvider } from "../ethprovider";

const { AddressZero } = constants;

export const withdrawFromChannel = async (
  client: IConnextClient,
  amount: BigNumber,
  assetId: string,
  recipient: string = Wallet.createRandom().address,
): Promise<void> => {
  // try to withdraw
  const preWithdrawalBalance = await client.getFreeBalance(assetId);
  const expected = preWithdrawalBalance[client.signerAddress].sub(amount);
  const log = new ColorfulLogger("WithdrawFromChannel", env.logLevel);
  log.info(`client.withdraw() called`);
  const start = Date.now();
  const { transaction } = await client.withdraw({
    amount,
    assetId,
    recipient,
  });
  log.info(`client.withdraw() returned in ${Date.now() - start}ms`);
  const postWithdrawalBalance = await client.getFreeBalance(assetId);
  let recipientBalance: BigNumber;
  if (assetId === AddressZero) {
    recipientBalance = await ethProvider.getBalance(recipient);
  } else {
    const token = new Contract(client.config.contractAddresses.Token!, ERC20.abi, ethProvider);
    recipientBalance = await token.balanceOf(recipient);
  }
  expect(recipientBalance).to.be.at.least(amount.toString());
  expect(postWithdrawalBalance[client.signerAddress].toString()).to.be.eq(expected.toString());
  expect(transaction.hash).to.exist;
  return;
};
