import { ChannelState, DepositParameters, convert } from "@connext/types";
import { Node as CFModuleTypes } from "@counterfactual/types";
import { BigNumber } from "ethers/utils";

import { logEthFreeBalance } from "../lib/utils";

import { AbstractController } from "./AbstractController";
// import { Validator } from "class-validator";

export class DepositController extends AbstractController {
  // TODO: implement decorator?
  // private validator: Validator = new Validator();

  // @IsValidDepositRequest()
  private params: DepositParameters;

  public deposit = async (params: DepositParameters): Promise<ChannelState> => {
    this.log.info(`Deposit called with params: ${JSON.stringify(params)}`);

    const myFreeBalanceAddress = this.cfModule.ethFreeBalanceAddress;
    this.log.info(`myFreeBalanceAddress: ${myFreeBalanceAddress}`);

    // TODO:  Generate and expose multisig address in connext internal
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

      const [counterpartyFreeBalanceAddress] = Object.keys(preDepositBalances).filter(
        (addr: string): boolean => addr !== myFreeBalanceAddress,
      );
    }

    this.params = convert.Deposit("bignumber", params);
    // const invalid = this.validator.validate(this);
    // if (invalid) {
    //   throw new Error(invalid.toString())
    // }

    this.log.info(`\nDepositing ${params.amount} ETH into ${this.connext.opts.multisigAddress}\n`);

    // register listeners
    this.log.info("Registering listeners........");
    this.registerListeners();
    this.log.info("Registered!");

    try {
      this.log.info(`Calling ${CFModuleTypes.RpcMethodName.DEPOSIT}`);
      const depositResponse = await this.connext.cfDeposit(new BigNumber(params.amount));
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
  }

  /////////////////////////////////
  ////// PRIVATE METHODS

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
