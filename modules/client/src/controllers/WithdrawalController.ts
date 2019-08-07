import { BigNumber, ChannelState, convert, WithdrawParameters } from "@connext/types";
import { Node as CFModuleTypes } from "@counterfactual/types";

import { invalidAddress } from "../validation/addresses";
import { falsy, notLessThanOrEqualTo } from "../validation/bn";

import { AbstractController } from "./AbstractController";

export class WithdrawalController extends AbstractController {
  public async withdraw(params: WithdrawParameters): Promise<ChannelState> {
    const myFreeBalanceAddress = this.connext.freeBalanceAddress;

    const { amount, assetId, recipient } = convert.Withdraw("bignumber", params);

    const invalid = await this.validateInputs(amount, assetId, recipient);
    if (invalid) {
      throw new Error(invalid);
    }

    const preWithdrawBalances = await this.connext.getFreeBalance(assetId);

    this.log.info(`\nWithdrawing ${amount} wei from ${this.connext.opts.multisigAddress}\n`);

    // register listeners
    this.registerListeners();

    let transactionHash: string | undefined = undefined;
    try {
      this.log.info(`Calling ${CFModuleTypes.RpcMethodName.WITHDRAW}`);
      const withdrawResponse = await this.connext.cfWithdraw(assetId, amount, recipient);
      this.log.info(`Withdraw Response: ${JSON.stringify(withdrawResponse, null, 2)}`);
      transactionHash = withdrawResponse.txHash;

      const postWithdrawBalances = await this.connext.getFreeBalance(assetId);

      const expectedFreeBal = preWithdrawBalances[myFreeBalanceAddress].sub(amount);

      // sanity check the free balance decrease
      if (postWithdrawBalances && !postWithdrawBalances[myFreeBalanceAddress].eq(expectedFreeBal)) {
        this.log.error(`My free balance was not decreased by the expected amount.`);
      }

      this.log.info("Withdrawn!");
    } catch (e) {
      this.log.error(`Failed to withdraw... ${JSON.stringify(e, null, 2)}`);
      this.removeListeners();
      throw new Error(e);
    }

    // TODO: fix types!
    return {
      apps: await this.connext.getAppInstances(),
      freeBalance: await this.connext.getFreeBalance(),
      transactionHash,
    } as any;
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
    console.log(`Withdrawal failed with data: ${JSON.stringify(data, null, 2)}`)
    this.removeListeners();
  };

  ////// Listener registration/deregistration
  private registerListeners(): void {
    this.listener.registerCfListener(
      CFModuleTypes.EventName.WITHDRAWAL_CONFIRMED,
      this.withdrawConfirmedCallback,
    );

    this.listener.registerCfListener(
      CFModuleTypes.EventName.WITHDRAWAL_FAILED,
      this.withdrawFailedCallback,
    );
  }

  private removeListeners(): void {
    this.listener.removeCfListener(
      CFModuleTypes.EventName.WITHDRAWAL_CONFIRMED,
      this.withdrawConfirmedCallback,
    );

    this.listener.removeCfListener(
      CFModuleTypes.EventName.WITHDRAWAL_FAILED,
      this.withdrawFailedCallback,
    );
  }
}
