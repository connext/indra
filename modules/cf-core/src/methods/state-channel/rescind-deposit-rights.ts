import { MethodNames, MethodParams, MethodResults } from "@connext/types";
import { Contract } from "ethers";
import { Zero } from "ethers/constants";
import { BigNumber } from "ethers/utils";
import { jsonRpcMethod } from "rpc-server";

import { CONVENTION_FOR_ETH_TOKEN_ADDRESS } from "../../constants";
import { ERC20 } from "../../contracts";
import { RequestHandler } from "../../request-handler";
import { NodeController } from "../controller";

import { uninstallBalanceRefundApp } from "./deposit";
import { NO_STATE_CHANNEL_FOR_MULTISIG_ADDR } from "../../errors";
import { StateChannel } from "../../models";

export class RescindDepositRightsController extends NodeController {
  @jsonRpcMethod(MethodNames.chan_rescindDepositRights)
  public executeMethod = super.executeMethod;

  protected async getRequiredLockNames(
    requestHandler: RequestHandler,
    params: MethodParams.RescindDepositRights,
  ): Promise<string[]> {
    return [params.multisigAddress];
  }

  protected async beforeExecution(
    requestHandler: RequestHandler,
    params: MethodParams.RescindDepositRights,
  ): Promise<void> {}

  protected async executeMethodImplementation(
    requestHandler: RequestHandler,
    params: MethodParams.RescindDepositRights,
  ): Promise<MethodResults.RescindDepositRights> {
    const { provider, store, networkContext } = requestHandler;
    const { multisigAddress } = params;
    const tokenAddress = params.tokenAddress || CONVENTION_FOR_ETH_TOKEN_ADDRESS;

    let multisigBalance: BigNumber;
    if (tokenAddress === CONVENTION_FOR_ETH_TOKEN_ADDRESS) {
      multisigBalance = await provider.getBalance(multisigAddress);
    } else {
      const erc20Contract = new Contract(tokenAddress!, ERC20.abi, provider);
      multisigBalance = await erc20Contract.balanceOf(multisigAddress);
    }

    const json = await store.getStateChannel(multisigAddress);
    if (!json) {
      throw new Error(NO_STATE_CHANNEL_FOR_MULTISIG_ADDR(multisigAddress));
    }
    const channel = StateChannel.fromJson(json);
    if (!channel.hasAppInstanceOfKind(networkContext.CoinBalanceRefundApp)) {
      return {
        multisigBalance,
        tokenAddress,
      };
    }

    await uninstallBalanceRefundApp(
      requestHandler,
      {
        ...params,
        // unused params to make types happy
        amount: Zero,
        tokenAddress,
      },
      await provider.getBlockNumber(),
    );

    return {
      multisigBalance,
      tokenAddress,
    };
  }
}
