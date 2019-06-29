import { ChannelState, DepositParameters } from "@connext/types";
import { Node as CFModuleTypes } from "@counterfactual/types";
import { BigNumber } from "ethers/utils";

import { ConnextInternal } from "../connext";
import { logEthFreeBalance } from "../lib/utils";

import { AbstractController } from "./AbstractController";

export class DepositController extends AbstractController {
  constructor(name: string, connext: ConnextInternal) {
    super(name, connext);
    // bind listener callbacks
    this.depositStartedCallback = this.depositStartedCallback.bind(this);
    this.depositConfirmedCallback = this.depositConfirmedCallback.bind(this);
    this.depositFailedCallback = this.depositFailedCallback.bind(this);
  }

  public async deposit(params: DepositParameters): Promise<ChannelState> {
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
  private depositStartedCallback(data: any): void {
    this.log.info(`Deposit started. Data: ${JSON.stringify(data, null, 2)}`);
  }

  private depositConfirmedCallback(data: any): void {
    this.log.info(`Deposit confirmed. Data: ${JSON.stringify(data, null, 2)}`);
    this.removeListeners();
  }

  private depositFailedCallback(data: any): void {
    this.log.info(`Deposit failed. Data: ${JSON.stringify(data, null, 2)}`);
    this.removeListeners();
  }

  ////// Listener registration/deregistration
  private registerListeners(): void {
    this.listener.registerCfListener(
      CFModuleTypes.EventName.DEPOSIT_STARTED,
      this.depositStartedCallback,
    );

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
      CFModuleTypes.EventName.DEPOSIT_STARTED,
      this.depositStartedCallback,
    );

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
