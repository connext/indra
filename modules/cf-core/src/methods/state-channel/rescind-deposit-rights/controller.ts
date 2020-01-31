import { Zero, AddressZero } from "ethers/constants";
import { jsonRpcMethod } from "rpc-server";

import { CONVENTION_FOR_ETH_TOKEN_ADDRESS } from "../../../constants";
import { ERC20 } from "../../../contracts";
import { RequestHandler } from "../../../request-handler";
import { CFCoreTypes, ProtocolTypes } from "../../../types";
import { NodeController } from "../../controller";
import { uninstallBalanceRefundApp } from "../deposit/operation";
import { BigNumber } from "ethers/utils";
import { Contract } from "ethers";
import { CoinBalanceRefundAppState } from "@connext/types";
import { xkeyKthAddress } from "../../../machine";
import { NOT_YOUR_BALANCE_REFUND_APP } from "../../errors";

export default class RescindDepositRightsController extends NodeController {
  @jsonRpcMethod(ProtocolTypes.chan_rescindDepositRights)
  public executeMethod: (
    requestHandler: RequestHandler,
    params: CFCoreTypes.MethodParams
  ) => Promise<CFCoreTypes.MethodResult> = super.executeMethod;

  protected async getRequiredLockNames(
    requestHandler: RequestHandler,
    params: CFCoreTypes.RescindDepositRightsParams
  ): Promise<string[]> {
    return [params.multisigAddress];
  }

  protected async beforeExecution(
    requestHandler: RequestHandler,
    params: CFCoreTypes.RescindDepositRightsParams
  ): Promise<void> {
    const { store, publicIdentifier } = requestHandler;
    const { multisigAddress, tokenAddress } = params;
    const stateChannel = await store.getStateChannel(multisigAddress);
    const refundApp = stateChannel.getBalanceRefundAppInstance(
      tokenAddress || AddressZero
    );

    if (!refundApp) {
      return;
    }

    // make sure its your app
    const { recipient } = refundApp.latestState as CoinBalanceRefundAppState;
    if (recipient !== xkeyKthAddress(publicIdentifier)) {
      throw new Error(NOT_YOUR_BALANCE_REFUND_APP);
    }
  }

  protected async executeMethodImplementation(
    requestHandler: RequestHandler,
    params: CFCoreTypes.RescindDepositRightsParams
  ): Promise<CFCoreTypes.DepositResult> {
    const { provider, store, networkContext } = requestHandler;
    const { multisigAddress } = params;
    const tokenAddress =
      params.tokenAddress || CONVENTION_FOR_ETH_TOKEN_ADDRESS;

    let multisigBalance: BigNumber;
    if (tokenAddress === CONVENTION_FOR_ETH_TOKEN_ADDRESS) {
      multisigBalance = await provider.getBalance(multisigAddress);
    } else {
      const erc20Contract = new Contract(tokenAddress!, ERC20.abi, provider);
      multisigBalance = await erc20Contract.balanceOf(multisigAddress);
    }

    const channel = await store.getStateChannel(multisigAddress);
    if (!channel.hasAppInstanceOfKind(networkContext.CoinBalanceRefundApp)) {
      return {
        multisigBalance,
        tokenAddress
      };
    }

    await uninstallBalanceRefundApp(
      requestHandler,
      {
        ...params,
        // unused params to make types happy
        tokenAddress,
        amount: Zero
      },
      await provider.getBlockNumber()
    );

    return {
      multisigBalance,
      tokenAddress
    };
  }
}
