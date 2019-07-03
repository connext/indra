import { BigNumber, ChannelState, convert, DepositParameters } from "@connext/types";
import { Node as CFModuleTypes } from "@counterfactual/types";

import { logEthFreeBalance } from "../lib/utils";
import { invalidAddress } from "../validation/addresses";
import { falsy, notLessThanOrEqualTo, notPositive } from "../validation/bn";

import { AbstractController } from "./AbstractController";

export class DepositController extends AbstractController {
  public deposit = async (params: DepositParameters): Promise<ChannelState> => {
    const myFreeBalanceAddress = this.cfModule.ethFreeBalanceAddress;
    this.log.info(`myFreeBalanceAddress: ${myFreeBalanceAddress}`);

    // TODO: remove free balance stuff?
    this.log.info("trying to get free balance....");
    const preDepositBalances = await this.connext.getFreeBalance();
    this.log.info(`preDepositBalances:`);
    this.connext.logEthFreeBalance(preDepositBalances, this.log);

    // TODO: why isnt free balance working :(
    if (preDepositBalances) {
      if (Object.keys(preDepositBalances).length !== 2) {
        throw new Error("Unexpected number of entries");
      }

      if (!preDepositBalances[myFreeBalanceAddress]) {
        throw new Error("My address not found");
      }
    }

    const { assetId, amount } = convert.Deposit("bignumber", params);
    const invalid = await this.validateInputs(assetId, amount);
    if (invalid) {
      throw new Error(invalid);
    }

    this.log.info(`\nDepositing ${amount} ETH into ${this.connext.opts.multisigAddress}\n`);

    // register listeners
    this.log.info("Registering listeners........");
    this.registerListeners();
    this.log.info("Registered!");

    try {
      this.log.info(`Calling ${CFModuleTypes.RpcMethodName.DEPOSIT}`);
      const depositResponse = await this.connext.cfDeposit(new BigNumber(amount));
      this.log.info(`Deposit Response: ${JSON.stringify(depositResponse, null, 2)}`);

      const postDepositBalances = await this.connext.getFreeBalance();

      this.log.info(`postDepositBalances:`);
      logEthFreeBalance(postDepositBalances, this.log);

      if (
        postDepositBalances &&
        !postDepositBalances[myFreeBalanceAddress].gt(preDepositBalances[myFreeBalanceAddress])
      ) {
        throw new Error("My balance was not increased.");
      }

      this.log.info("Deposited!");
      logEthFreeBalance(await this.connext.getFreeBalance());
    } catch (e) {
      this.log.error(`Failed to deposit... ${e}`);
      this.removeListeners();
      throw new Error(e);
    }

    // TODO: fix types!
    return {
      apps: await this.connext.getAppInstances(),
      freeBalance: await this.connext.getFreeBalance(),
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

    // TODO: wtf --> fix this!
    // const depositAddr = publicIdentifierToAddress(this.cfModule.publicIdentifier);
    // TODO: whats the path for this address?
    const depositAddr = "0x24ac59b070eC2EA822249cB2A858208460305Faa";
    const bal = await this.provider.getBalance(depositAddr);
    this.log.info(`${bal.toString()}, ${notLessThanOrEqualTo(amount, bal)}`)
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
