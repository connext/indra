import { ChannelState, DepositParameters } from "@connext/types";
import { Node as CFModuleTypes } from "@counterfactual/types";
import { utils as ethers } from "ethers";
import { v4 as generateUUID } from "uuid";

import { delay, getFreeBalance, logEthFreeBalance } from "../lib/utils";

import { AbstractController } from "./AbstractController";

export class DepositController extends AbstractController {
  public async deposit(params: DepositParameters): Promise<ChannelState> {
    this.log.info("Deposit called, yay!");

    const myFreeBalanceAddress = this.cfModule.ethFreeBalanceAddress;
    console.log("myFreeBalanceAddress:", myFreeBalanceAddress);

    // TODO:  Generate and expose multisig address in connext internal
    console.log("trying to get free balance....");
    const preDepositBalances = await getFreeBalance(
      this.cfModule,
      this.connext.opts.multisigAddress,
    );
    console.log("preDepositBalances:", preDepositBalances);

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

    console.log(`\nDepositing ${params.amount} ETH into ${this.connext.opts.multisigAddress}\n`);

    // register listeners
    console.log("Registering listeners........");
    // TODO: theres probably a significantly better way to do this
    this.cfModule.once(CFModuleTypes.EventName.DEPOSIT_STARTED, (data: any) => {
      console.log("Deposit has started. Data:", JSON.stringify(data, null, 2));
    });

    this.cfModule.once(CFModuleTypes.EventName.DEPOSIT_CONFIRMED, (data: any) => {
      console.log("Deposit has been confirmed. Data:", JSON.stringify(data, null, 2));
    });

    this.cfModule.once(CFModuleTypes.EventName.DEPOSIT_FAILED, (data: any) => {
      console.log("Deposit has failed. Data:", JSON.stringify(data, null, 2));
    });

    console.log("Registered!");

    try {
      console.log("Calling", CFModuleTypes.RpcMethodName.DEPOSIT);
      await this.cfModule.call(CFModuleTypes.RpcMethodName.DEPOSIT, {
        params: {
          amount: ethers.parseEther(params.amount) as any, // FIXME
          multisigAddress: this.connext.opts.multisigAddress,
          notifyCounterparty: true,
        } as CFModuleTypes.DepositParams,
        requestId: generateUUID(),
        type: CFModuleTypes.MethodName.DEPOSIT,
      });
      console.log("Called", CFModuleTypes.MethodName.DEPOSIT, "!");

      const postDepositBalances = await getFreeBalance(
        this.cfModule,
        this.connext.opts.multisigAddress,
      );

      console.log("postDepositBalances:", JSON.stringify(postDepositBalances, null, 2));

      if (postDepositBalances && !postDepositBalances[myFreeBalanceAddress].gt(preDepositBalances[myFreeBalanceAddress])) {
        throw Error("My balance was not increased.");
      }

      // // TODO: delete this, do not need to wait for the counterparty deposit
      // // within the controller
      // console.info("Waiting for counter party to deposit same amount");

      // const freeBalanceNotUpdated = async (): Promise<any> => {
      //   return !(await getFreeBalance(this.cfModule, this.connext.opts.multisigAddress))[
      //     counterpartyFreeBalanceAddress
      //   ].gt(preDepositBalances[counterpartyFreeBalanceAddress]);
      // };

      // while (await freeBalanceNotUpdated()) {
      //   console.info(`Waiting 1 more seconds for counter party deposit`);
      //   await delay(1 * 1000);
      // }

      console.log("Deposited!");
      // logEthFreeBalance(await getFreeBalance(this.cfModule, this.connext.opts.multisigAddress));
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
