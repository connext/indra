import { Node as CFModuleTypes } from "@counterfactual/types";
import { utils as ethers } from "ethers";
import { v4 as generateUUID } from "uuid";

import { delay, getFreeBalance, logEthFreeBalance } from "../lib/utils";
import { ChannelState, DepositParameters } from "../types";

import { AbstractController } from "./AbstractController";

export class DepositController extends AbstractController {
  public async deposit(params: DepositParameters): Promise<ChannelState> {
    this.log.info("Deposit called, yay!");

    const myFreeBalanceAddress = this.cfModule.ethFreeBalanceAddress;

    // TODO:  Generate and expose multisig address in connext internal
    const preDepositBalances = await getFreeBalance(
      this.cfModule,
      this.connext.opts.multisigAddress,
    );

    if (Object.keys(preDepositBalances).length !== 2) {
      throw new Error("Unexpected number of entries");
    }

    if (!preDepositBalances[myFreeBalanceAddress]) {
      throw new Error("My address not found");
    }

    const [counterpartyFreeBalanceAddress] = Object.keys(preDepositBalances).filter(
      (addr: string): boolean => addr !== myFreeBalanceAddress,
    );

    console.log(`\nDepositing ${params.amount} ETH into ${this.connext.opts.multisigAddress}\n`);
    try {
      await this.cfModule.call(CFModuleTypes.MethodName.DEPOSIT, {
        params: {
          amount: ethers.parseEther(params.amount),
          multisigAddress: this.connext.opts.multisigAddress,
          notifyCounterparty: true,
        } as CFModuleTypes.DepositParams,
        requestId: generateUUID(),
        type: CFModuleTypes.MethodName.DEPOSIT,
      });

      const postDepositBalances = await getFreeBalance(
        this.cfModule,
        this.connext.opts.multisigAddress,
      );

      if (!postDepositBalances[myFreeBalanceAddress].gt(preDepositBalances[myFreeBalanceAddress])) {
        throw Error("My balance was not increased.");
      }

      console.info("Waiting for counter party to deposit same amount");

      const freeBalanceNotUpdated = async (): Promise<any> => {
        return !(await getFreeBalance(this.cfModule, this.connext.opts.multisigAddress))[
          counterpartyFreeBalanceAddress
        ].gt(preDepositBalances[counterpartyFreeBalanceAddress]);
      };

      while (await freeBalanceNotUpdated()) {
        console.info(`Waiting 1 more seconds for counter party deposit`);
        await delay(1 * 1000);
      }

      logEthFreeBalance(await getFreeBalance(this.cfModule, this.connext.opts.multisigAddress));
    } catch (e) {
      console.error(`Failed to deposit... ${e}`);
      throw e;
    }

    return {
      apps: [],
      freeBalance: await getFreeBalance(this.cfModule, this.connext.opts.multisigAddress),
    } as ChannelState;
  }
}
