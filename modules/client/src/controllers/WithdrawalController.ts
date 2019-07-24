import { BigNumber, ChannelState, convert, WithdrawParameters } from "@connext/types";
import { Node as CFModuleTypes } from "@counterfactual/types";

import { logEthFreeBalance } from "../lib/utils";
import { invalidAddress } from "../validation/addresses";
import { falsy, notLessThanOrEqualTo } from "../validation/bn";

import { AbstractController } from "./AbstractController";

export class WithdrawalController extends AbstractController {
  public async withdraw(params: WithdrawParameters): Promise<ChannelState> {
    const myFreeBalanceAddress = this.connext.freeBalanceAddress;

    const { amount, recipient, assetId } = convert.Withdraw("bignumber", params);

    const invalid = await this.validateInputs(amount, assetId, recipient);
    if (invalid) {
      throw new Error(invalid);
    }

    // TODO: remove free balance stuff?
    this.log.info("trying to get free balance....");
    const preWithdrawBalances = await this.connext.getFreeBalance(assetId);
    this.log.info(`preWithdrawBalances:`);
    this.connext.logEthFreeBalance(assetId, preWithdrawBalances, this.log);

    // TODO: why isnt free balance working :(
    if (preWithdrawBalances) {
      if (Object.keys(preWithdrawBalances).length !== 2) {
        throw new Error("Unexpected number of entries");
      }

      if (!preWithdrawBalances[myFreeBalanceAddress]) {
        throw new Error("My address not found");
      }
    }

    this.log.info(`\nWithdrawing ${amount} wei from ${this.connext.opts.multisigAddress}\n`);

    // register listeners
    this.log.info("Registering listeners........");
    this.registerListeners();
    this.log.info("Registered!");

    try {
      this.log.info(`Calling ${CFModuleTypes.RpcMethodName.WITHDRAW}`);
      const withdrawResponse = await this.connext.cfWithdraw(assetId, amount, recipient);
      this.log.info(`Withdraw Response: ${JSON.stringify(withdrawResponse, null, 2)}`);

      const postWithdrawBalances = await this.connext.getFreeBalance(assetId);

      this.log.info(`postWithdrawBalances:`);
      logEthFreeBalance(assetId, postWithdrawBalances, this.log);

      const expectedFreeBal = preWithdrawBalances[myFreeBalanceAddress].sub(amount);

      // sanity check the free balance decrease
      if (postWithdrawBalances && !postWithdrawBalances[myFreeBalanceAddress].eq(expectedFreeBal)) {
        this.log.error(`My free balance was not decreased by the expected amount.`);
      }

      this.log.info("Withdrawn!");
    } catch (e) {
      this.log.error(`Failed to withdraw... ${e}`);
      this.removeListeners();
      throw new Error(e);
    }

    // TODO: fix types!
    return {
      apps: await this.connext.getAppInstances(),
      freeBalance: await this.connext.getFreeBalance(),
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
