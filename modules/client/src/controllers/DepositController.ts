import { Contract } from "ethers";
import { AddressZero } from "ethers/constants";
import tokenAbi from "human-standard-token-abi";

import { stringify, xpubToAddress } from "../lib/utils";
import { BigNumber, CFCoreTypes, ChannelState, convert, DepositParameters } from "../types";
import { invalidAddress } from "../validation/addresses";
import { falsy, notLessThanOrEqualTo, notPositive } from "../validation/bn";

import { AbstractController } from "./AbstractController";

export class DepositController extends AbstractController {
  public deposit = async (params: DepositParameters): Promise<ChannelState> => {
    const myFreeBalanceAddress = this.connext.freeBalanceAddress;

    const { assetId, amount } = convert.Deposit("bignumber", params);
    const invalid = await this.validateInputs(assetId, amount);
    if (invalid) {
      throw new Error(invalid);
    }

    // TODO: remove free balance stuff?
    const preDepositBalances = await this.connext.getFreeBalance(assetId);

    this.log.info(`\nDepositing ${amount} of ${assetId} into ${this.connext.multisigAddress}\n`);

    // register listeners
    this.log.info("Registering listeners........");
    this.registerListeners();
    this.log.info("Registered!");

    try {
      this.log.info(`Calling ${CFCoreTypes.RpcMethodName.DEPOSIT}`);
      const depositResponse = await this.connext.providerDeposit(amount, assetId);
      this.log.info(`Deposit Response: ${stringify(depositResponse)}`);

      const postDepositBalances = await this.connext.getFreeBalance(assetId);

      const diff = postDepositBalances[myFreeBalanceAddress].sub(
        preDepositBalances[myFreeBalanceAddress],
      );

      if (!diff.eq(amount)) {
        throw new Error("My balance was not increased by the deposit amount.");
      }

      this.log.info("Deposited!");
    } catch (e) {
      this.log.error(`Failed to deposit...`);
      this.removeListeners();
      throw e;
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
    const depositAddr = xpubToAddress(this.connext.publicIdentifier);
    let bal: BigNumber;
    if (assetId === AddressZero) {
      bal = await this.ethProvider.getBalance(depositAddr);
    } else {
      // get token balance
      const token = new Contract(assetId, tokenAbi, this.ethProvider);
      // TODO: correct? how can i use allowance?
      bal = await token.balanceOf(depositAddr);
    }
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
      CFCoreTypes.EventName.DEPOSIT_CONFIRMED,
      this.depositConfirmedCallback,
    );

    this.listener.registerCfListener(
      CFCoreTypes.EventName.DEPOSIT_FAILED,
      this.depositFailedCallback,
    );
  }

  private removeListeners(): void {
    this.listener.removeCfListener(
      CFCoreTypes.EventName.DEPOSIT_CONFIRMED,
      this.depositConfirmedCallback,
    );

    this.listener.removeCfListener(
      CFCoreTypes.EventName.DEPOSIT_FAILED,
      this.depositFailedCallback,
    );
  }
}
