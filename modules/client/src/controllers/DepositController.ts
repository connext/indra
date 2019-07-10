import { BigNumber, ChannelState, convert, DepositParameters } from "@connext/types";
import { Node as CFModuleTypes } from "@counterfactual/types";
import { Contract } from "ethers";
import { AddressZero } from "ethers/constants";
import tokenAbi from "human-standard-token-abi";

import { logEthFreeBalance, publicIdentifierToAddress } from "../lib/utils";
import { invalidAddress } from "../validation/addresses";
import { falsy, notLessThanOrEqualTo, notPositive } from "../validation/bn";

import { AbstractController } from "./AbstractController";

export class DepositController extends AbstractController {
  public deposit = async (params: DepositParameters): Promise<ChannelState> => {
    const myFreeBalanceAddress = this.cfModule.ethFreeBalanceAddress;
    this.log.info(`myFreeBalanceAddress: ${myFreeBalanceAddress}`);

    const { assetId, amount } = convert.Deposit("bignumber", params);
    const invalid = await this.validateInputs(assetId, amount);
    if (invalid) {
      throw new Error(invalid);
    }

    // TODO: remove free balance stuff?
    this.log.info("trying to get free balance....");
    const preDepositBalances = await this.connext.getFreeBalance(assetId);
    this.log.info(`preDepositBalances:`);
    this.connext.logEthFreeBalance(assetId, preDepositBalances, this.log);

    // TODO: why isnt free balance working :(
    if (preDepositBalances) {
      if (Object.keys(preDepositBalances).length !== 2) {
        throw new Error("Unexpected number of entries");
      }

      if (!preDepositBalances[myFreeBalanceAddress]) {
        throw new Error("My address not found");
      }
    }

    this.log.info(
      `\nDepositing ${amount} of ${assetId} into ${this.connext.opts.multisigAddress}\n`,
    );

    // register listeners
    this.log.info("Registering listeners........");
    this.registerListeners();
    this.log.info("Registered!");

    try {
      this.log.info(`Calling ${CFModuleTypes.RpcMethodName.DEPOSIT}`);
      const depositResponse = await this.connext.cfDeposit(amount, assetId);
      this.log.info(`Deposit Response: ${JSON.stringify(depositResponse, null, 2)}`);

      const postDepositBalances = await this.connext.getFreeBalance(assetId);

      this.log.info(`postDepositBalances:`);
      logEthFreeBalance(assetId, postDepositBalances, this.log);

      const diff = postDepositBalances[myFreeBalanceAddress].sub(
        preDepositBalances[myFreeBalanceAddress],
      );

      if (!diff.eq(amount)) {
        throw new Error("My balance was not increased by the deposit amount.");
      }

      this.log.info("Deposited!");
      logEthFreeBalance(assetId, await this.connext.getFreeBalance(assetId), this.log);
    } catch (e) {
      this.log.error(`Failed to deposit...`);
      this.removeListeners();
      throw new Error(e);
    }

    // TODO: fix types!
    return {
      apps: await this.connext.getAppInstances(),
      freeBalance: await this.connext.getFreeBalance(assetId),
    } as any;
  };

  /////////////////////////////////
  ////// PRIVATE METHODS

  ////// Validation
  private validateInputs = async (
    assetId: string,
    amount: BigNumber,
  ): Promise<string | undefined> => {
    // check asset balance of address
    // TODO: fix for non-eth balances
    const depositAddr = publicIdentifierToAddress(this.cfModule.publicIdentifier);
    let bal: BigNumber;
    if (assetId === AddressZero) {
      bal = await this.provider.getBalance(depositAddr);
    } else {
      // get token balance
      const token = new Contract(assetId, tokenAbi, this.provider);
      // TODO: correct? how can i use allowance?
      bal = await token.balanceOf(depositAddr);
    }
    this.log.info(`${bal.toString()}, ${notLessThanOrEqualTo(amount, bal)}`);
    const errs = [
      invalidAddress(assetId),
      notPositive(amount),
      notLessThanOrEqualTo(amount, bal), // cant deposit more than default addr owns
    ];
    return errs ? errs.filter(falsy)[0] : undefined;
  };

  ////// Listener callbacks
  private depositConfirmedCallback = (data: any): void => {
    this.removeListeners();
  };

  private depositFailedCallback = (data: any): void => {
    this.removeListeners();
  };

  ////// Listener registration/deregistration
  private registerListeners(): void {
    this.listener.registerCfListener(
      CFModuleTypes.EventName.DEPOSIT_CONFIRMED,
      this.depositConfirmedCallback,
    );

    this.listener.registerCfListener(
      CFModuleTypes.EventName.DEPOSIT_FAILED,
      this.depositFailedCallback,
    );
  }

  private removeListeners(): void {
    this.listener.removeCfListener(
      CFModuleTypes.EventName.DEPOSIT_CONFIRMED,
      this.depositConfirmedCallback,
    );

    this.listener.removeCfListener(
      CFModuleTypes.EventName.DEPOSIT_FAILED,
      this.depositFailedCallback,
    );
  }
}
