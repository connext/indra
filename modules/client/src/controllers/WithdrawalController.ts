import { MethodNames, MinimalTransaction } from "@connext/types";
import { AddressZero } from "ethers/constants";
import { TransactionResponse } from "ethers/providers";
import { bigNumberify, formatEther, getAddress } from "ethers/utils";

import { stringify } from "../lib";
import {
  convert,
  WithdrawalResponse,
  WithdrawParameters,
  chan_setUserWithdrawal,
} from "../types";
import { invalidAddress, notLessThanOrEqualTo, notPositive, validate } from "../validation";

import { AbstractController } from "./AbstractController";

export class WithdrawalController extends AbstractController {
  public async withdraw(params: WithdrawParameters): Promise<WithdrawalResponse> {
    if (params.assetId) {
      try {
        params.assetId = getAddress(params.assetId);
      } catch (e) {
        // likely means that this is an invalid eth address, so
        // use validator fn for better error message
        validate(invalidAddress(params.assetId));
      }
    }
    const myFreeBalanceAddress = this.connext.freeBalanceAddress;

    const { amount, assetId, recipient, userSubmitted } = convert.Withdraw(`bignumber`, params);
    const freeBalance = await this.connext.getFreeBalance(assetId);
    const preWithdrawalBal = freeBalance[this.connext.freeBalanceAddress];
    validate(
      notPositive(amount),
      notLessThanOrEqualTo(amount, preWithdrawalBal),
      invalidAddress(assetId), // check address of asset
    );
    if (recipient) {
      validate(invalidAddress(recipient));
    }

    const preWithdrawBalances = await this.connext.getFreeBalance(assetId);

    this.log.info(
      `Withdrawing ${formatEther(amount)} ${
        assetId === AddressZero ? "ETH" : "Tokens"
      } from multisig to ${recipient}`,
    );

    let transaction: TransactionResponse | undefined;
    try {
      this.log.info(`Rescinding deposit rights before withdrawal`);
      await this.connext.rescindDepositRights({ assetId });
      if (!userSubmitted) {
        const withdrawResponse = await this.connext.withdrawCommitment(amount, assetId, recipient);
        this.log.info(`WithdrawCommitment submitted`);
        this.log.debug(`Details of submitted withdrawal: ${stringify(withdrawResponse)}`);
        const minTx: MinimalTransaction = withdrawResponse.transaction;
        // set the withdrawal tx in the store
        await this.connext.channelProvider.send(chan_setUserWithdrawal, {
          withdrawalObject: { tx: minTx, retry: 0 },
        });

        transaction = await this.node.withdraw(minTx);

        await this.connext.watchForUserWithdrawal();

        this.log.info(`Node responded with transaction: ${transaction.hash}`);
        this.log.debug(`Transaction details: ${stringify(transaction)}`);
      } else {
        // first deploy the multisig
        const deployRes = await this.connext.deployMultisig();
        this.log.info(`Deploying multisig: ${deployRes.transactionHash}`);
        this.log.debug(`Multisig deploy transaction: ${stringify(deployRes)}`);
        if (deployRes.transactionHash !== AddressZero) {
          // wait for multisig deploy transaction
          // will be 0x000.. if the multisig has already been deployed.
          this.ethProvider.waitForTransaction(deployRes.transactionHash);
        }
        this.log.info(`Calling ${MethodNames.chan_withdraw}`);
        // user submitting the withdrawal
        const withdrawResponse = await this.connext.providerWithdraw(
          assetId,
          bigNumberify(amount),
          recipient,
        );
        this.log.info(`Node responded with transaction: ${withdrawResponse.txHash}`);
        this.log.debug(`Withdraw Response: ${stringify(withdrawResponse)}`);
        transaction = await this.ethProvider.getTransaction(withdrawResponse.txHash);
      }
      const postWithdrawBalances = await this.connext.getFreeBalance(assetId);

      this.log.debug(`Pre-Withdraw Balances: ${stringify(preWithdrawBalances)}`);
      const expectedFreeBal = bigNumberify(preWithdrawBalances[myFreeBalanceAddress]).sub(amount);

      // sanity check the free balance decrease
      if (postWithdrawBalances && !postWithdrawBalances[myFreeBalanceAddress].eq(expectedFreeBal)) {
        this.log.error(`My free balance was not decreased by the expected amount.`);
      }

      this.log.info(`Successfully Withdrew`);
    } catch (e) {
      this.log.error(`Failed to withdraw: ${e.stack || e.message}`);
      throw new Error(e);
    }

    return {
      apps: await this.connext.getAppInstances(),
      freeBalance: await this.connext.getFreeBalance(),
      transaction,
    };
  }
}
