import { BigNumber, convert, WithdrawalResponse, WithdrawParameters } from "@connext/types";
import { TransactionResponse } from "ethers/providers";
import { getAddress } from "ethers/utils";

import { CFCoreTypes } from "../lib/cfCore";
import { stringify, withdrawalKey } from "../lib/utils";
import { invalidAddress } from "../validation/addresses";
import { falsy, notLessThanOrEqualTo } from "../validation/bn";

import { AbstractController } from "./AbstractController";

export class WithdrawalController extends AbstractController {
  public async withdraw(params: WithdrawParameters): Promise<WithdrawalResponse> {
    params.assetId = params.assetId ? getAddress(params.assetId) : undefined;
    const myFreeBalanceAddress = this.connext.freeBalanceAddress;

    const { amount, assetId, recipient, userSubmitted } = convert.Withdraw("bignumber", params);

    const invalid = await this.validateInputs(amount, assetId, recipient);
    if (invalid) {
      throw new Error(invalid);
    }

    const preWithdrawBalances = await this.connext.getFreeBalance(assetId);

    this.log.info(`\nWithdrawing ${amount} wei from ${this.connext.multisigAddress}\n`);

    // register listeners
    this.registerListeners();

    let transaction: TransactionResponse | undefined;
    try {
      if (!userSubmitted) {
        this.log.info(`Calling ${CFCoreTypes.RpcMethodName.WITHDRAW_COMMITMENT}`);
        const withdrawResponse = await this.connext.withdrawCommitment(amount, assetId, recipient);
        this.log.info(`Withdraw Response: ${stringify(withdrawResponse)}`);
        const minTx: CFCoreTypes.MinimalTransaction = withdrawResponse.transaction;
        // set the withdrawal tx in the store
        await this.connext.store.set([
          {
            path: withdrawalKey(this.connext.publicIdentifier),
            value: { tx: minTx, retry: 0 },
          },
        ]);

        transaction = await this.node.withdraw(minTx);

        await this.connext.watchForUserWithdrawal();

        this.log.info(`Node Withdraw Response: ${stringify(transaction)}`);
      } else {
        this.log.info(`Calling ${CFCoreTypes.RpcMethodName.WITHDRAW}`);
        // user submitting the withdrawal
        const withdrawResponse = await this.connext.providerWithdraw(
          assetId,
          new BigNumber(amount),
          recipient,
        );
        this.log.info(`Withdraw Response: ${stringify(withdrawResponse)}`);
        transaction = await this.ethProvider.getTransaction(withdrawResponse.txHash);
      }
      const postWithdrawBalances = await this.connext.getFreeBalance(assetId);

      const expectedFreeBal = preWithdrawBalances[myFreeBalanceAddress].sub(amount);

      // sanity check the free balance decrease
      if (postWithdrawBalances && !postWithdrawBalances[myFreeBalanceAddress].eq(expectedFreeBal)) {
        this.log.error(`My free balance was not decreased by the expected amount.`);
      }

      this.log.info("Withdrawn!");
    } catch (e) {
      this.log.error(`Failed to withdraw... ${stringify(e)}`);
      this.removeListeners();
      throw new Error(e);
    }

    return {
      apps: await this.connext.getAppInstances(),
      freeBalance: await this.connext.getFreeBalance(),
      transaction,
    };
  }

  /////////////////////////////////
  ////// PRIVATE METHODS

  ////// Validation
  private validateInputs = async (
    amount: BigNumber,
    assetId: string,
    recipient?: string,
  ): Promise<string | undefined> => {
    // TODO: fix for non-eth withdrawals
    // check the free balance can handle requested amnt
    const freeBalance = await this.connext.getFreeBalance(assetId);
    const preWithdrawalBal = freeBalance[this.connext.freeBalanceAddress];
    const errs = [
      notLessThanOrEqualTo(amount, preWithdrawalBal),
      invalidAddress(assetId), // check address of asset
    ];
    if (recipient) {
      errs.push(invalidAddress(recipient));
    }
    return errs ? errs.filter(falsy)[0] : undefined;
  };

  ////// Listener callbacks
  private withdrawConfirmedCallback = async (data: any): Promise<void> => {
    this.log.info(`Withdrawal confimed.`);
    this.removeListeners();
  };

  private withdrawFailedCallback = (data: any): void => {
    this.log.warn(`Withdrawal failed with data: ${stringify(data)}`);
    this.removeListeners();
  };

  ////// Listener registration/deregistration
  private registerListeners(): void {
    this.listener.registerCfListener(
      CFCoreTypes.EventName.WITHDRAWAL_CONFIRMED,
      this.withdrawConfirmedCallback,
    );

    this.listener.registerCfListener(
      CFCoreTypes.EventName.WITHDRAWAL_FAILED,
      this.withdrawFailedCallback,
    );
  }

  private removeListeners(): void {
    this.listener.removeCfListener(
      CFCoreTypes.EventName.WITHDRAWAL_CONFIRMED,
      this.withdrawConfirmedCallback,
    );

    this.listener.removeCfListener(
      CFCoreTypes.EventName.WITHDRAWAL_FAILED,
      this.withdrawFailedCallback,
    );
  }
}
