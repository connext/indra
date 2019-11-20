import ERC20 from "@counterfactual/cf-funding-protocol-contracts/expected-build-artifacts/ERC20.json";
import { Zero } from "ethers/constants";
import { jsonRpcMethod } from "rpc-server";

import { CONVENTION_FOR_ETH_TOKEN_ADDRESS } from "../../../constants";
import { RequestHandler } from "../../../request-handler";
import { Node } from "../../../types";
import { NodeController } from "../../controller";
import { BALANCE_REFUND_APP_ALREADY_INSTALLED } from "../../errors";
import {
  installBalanceRefundApp,
  uninstallBalanceRefundApp
} from "../deposit/operation";
import { Contract } from "ethers";
import { BigNumber } from "ethers/utils";
import { xkeyKthAddress } from "../../../machine";

export default class InstallBalanceRefundController extends NodeController {
  @jsonRpcMethod(Node.RpcMethodName.INSTALL_BALANCE_REFUND)
  public executeMethod: (
    requestHandler: RequestHandler,
    params: Node.MethodParams
  ) => Promise<Node.MethodResult> = super.executeMethod;

  protected async getRequiredLockNames(
    requestHandler: RequestHandler,
    params: Node.InstallBalanceRefundParams
  ): Promise<string[]> {
    return [params.multisigAddress];
  }

  protected async beforeExecution(
    requestHandler: RequestHandler,
    params: Node.InstallBalanceRefundParams
  ): Promise<void> {}

  protected async executeMethodImplementation(
    requestHandler: RequestHandler,
    params: Node.InstallBalanceRefundParams
  ): Promise<Node.InstallBalanceRefundResult> {
    const {
      provider,
      store,
      networkContext,
      publicIdentifier
    } = requestHandler;
    const { multisigAddress, tokenAddress } = params;

    params.tokenAddress = tokenAddress || CONVENTION_FOR_ETH_TOKEN_ADDRESS;

    const channel = await store.getStateChannel(multisigAddress);
    let multisigBalance: BigNumber;
    if (params.tokenAddress === CONVENTION_FOR_ETH_TOKEN_ADDRESS) {
      multisigBalance = await provider.getBalance(multisigAddress);
    } else {
      const erc20Contract = new Contract(tokenAddress!, ERC20.abi, provider);
      multisigBalance = await erc20Contract.balanceOf(multisigAddress);
    }

    if (channel.hasAppInstanceOfKind(networkContext.CoinBalanceRefundApp)) {
      const balanceRefundApp = channel.getAppInstanceOfKind(
        networkContext.CoinBalanceRefundApp
      );
      // if app is already pointing at us and the multisig balance has not changed,
      // do not uninstall
      const appIsCorrectlyInstalled =
        balanceRefundApp.latestState["recipient"] ===
          xkeyKthAddress(publicIdentifier, 0) &&
        multisigBalance.eq(balanceRefundApp.latestState["threshold"]);

      if (appIsCorrectlyInstalled) {
        return {
          multisigBalance,
          latestState: balanceRefundApp.latestState
        };
      }

      await uninstallBalanceRefundApp(requestHandler, {
        ...params,
        amount: Zero
      });
    }
    await installBalanceRefundApp(requestHandler, { ...params, amount: Zero });
    return {
      multisigBalance,
      recipient: xkeyKthAddress(publicIdentifier, 0)
    };
  }
}
