import { Zero } from "ethers/constants";
import { jsonRpcMethod } from "rpc-server";

import { CONVENTION_FOR_ETH_TOKEN_ADDRESS } from "../../../constants";
import { StateChannel } from "../../../models";
import { RequestHandler } from "../../../request-handler";
import { DepositConfirmationMessage, Node, NODE_EVENTS } from "../../../types";
import { NodeController } from "../../controller";
import { BALANCE_REFUND_APP_ALREADY_INSTALLED } from "../../errors";
import { installBalanceRefundApp } from "../deposit/operation";

export default class InstallBalanceRefundController extends NodeController {
  @jsonRpcMethod(Node.RpcMethodName.INSTALL_BALANCE_REFUND)
  public executeMethod: (
    requestHandler: RequestHandler,
    params: Node.MethodParams
  ) => Promise<Node.MethodResult> = super.executeMethod;

  protected async getRequiredLockNames(
    requestHandler: RequestHandler,
    params: Node.DepositParams
  ): Promise<string[]> {
    return [params.multisigAddress];
  }

  protected async beforeExecution(
    requestHandler: RequestHandler,
    params: Node.DepositParams
  ): Promise<void> {
    const { store, networkContext } = requestHandler;
    const { multisigAddress } = params;

    const channel = await store.getStateChannel(multisigAddress);

    if (channel.hasAppInstanceOfKind(networkContext.CoinBalanceRefundApp)) {
      throw Error(BALANCE_REFUND_APP_ALREADY_INSTALLED);
    }
  }

  protected async executeMethodImplementation(
    requestHandler: RequestHandler,
    params: Node.InstallBalanceRefundParams
  ): Promise<Node.DepositResult> {
    const { outgoing, provider } = requestHandler;
    const { multisigAddress, tokenAddress } = params;

    params.tokenAddress = tokenAddress || CONVENTION_FOR_ETH_TOKEN_ADDRESS;

    await installBalanceRefundApp(requestHandler, { ...params, amount: Zero });

    // send deposit confirmation to counter party _after_ the balance refund
    // app is installed so as to prevent needing to handle the case of
    // the counter party hitting the issue of
    // "Cannot deposit while another deposit is occurring in the channel."
    const { messagingService, publicIdentifier, store } = requestHandler;
    const [counterpartyAddress] = await StateChannel.getPeersAddressFromChannel(
      publicIdentifier,
      store,
      multisigAddress
    );

    // const payload: DepositConfirmationMessage = {
    //   from: publicIdentifier,
    //   type: NODE_EVENTS.DEPOSIT_CONFIRMED,
    //   data: params
    // };

    // await messagingService.send(counterpartyAddress, payload);

    return {
      multisigBalance: await provider.getBalance(multisigAddress)
    };
  }
}
