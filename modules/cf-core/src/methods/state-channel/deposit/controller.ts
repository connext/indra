import { Contract } from "ethers";
import { BigNumber } from "ethers/utils";
import { jsonRpcMethod } from "rpc-server";

import { CONVENTION_FOR_ETH_TOKEN_ADDRESS } from "../../../constants";
import { ERC20 } from "../../../contracts";
import { StateChannel } from "../../../models";
import { RequestHandler } from "../../../request-handler";
import { DepositConfirmationMessage, Node, NODE_EVENTS, NodeEvent } from "../../../types";
import { NodeController } from "../../controller";
import {
  CANNOT_DEPOSIT,
  FAILED_TO_GET_ERC20_BALANCE,
  INSUFFICIENT_ERC20_FUNDS_TO_DEPOSIT,
  INSUFFICIENT_FUNDS,
  COIN_BALANCE_NOT_PROPOSED,
  INCORRECT_MULTISIG_ADDRESS,
  INVALID_FACTORY_ADDRESS
} from "../../errors";

import {
  installBalanceRefundApp,
  makeDeposit,
  uninstallBalanceRefundApp
} from "./operation";
import { getCreate2MultisigAddress } from "../../../utils";

export default class DepositController extends NodeController {
  @jsonRpcMethod(Node.RpcMethodName.DEPOSIT)
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
    const { store, provider, networkContext } = requestHandler;
    const { multisigAddress, amount, tokenAddress: tokenAddressParam } = params;

    const tokenAddress = tokenAddressParam || CONVENTION_FOR_ETH_TOKEN_ADDRESS;

    const channel = await store.getStateChannel(multisigAddress);

    if (!channel.proxyFactoryAddress) {
      throw Error(INVALID_FACTORY_ADDRESS(channel.proxyFactoryAddress));
    }

    const expectedMultisigAddress = await getCreate2MultisigAddress(
      channel.userNeuteredExtendedKeys,
      channel.proxyFactoryAddress,
      networkContext.MinimumViableMultisig,
      provider
    );

    if (expectedMultisigAddress !== channel.multisigAddress) {
      throw Error(INCORRECT_MULTISIG_ADDRESS);
    }

    if (
      channel.hasBalanceRefundAppInstance(
        networkContext.CoinBalanceRefundApp,
        tokenAddress
      )
    ) {
      throw Error(CANNOT_DEPOSIT);
    }

    if (
      !channel.hasProposedBalanceRefundAppInstance(
        networkContext.CoinBalanceRefundApp,
        tokenAddress
      )
    ) {
      throw Error(COIN_BALANCE_NOT_PROPOSED);
    }

    const address = await requestHandler.getSignerAddress();

    if (tokenAddress !== CONVENTION_FOR_ETH_TOKEN_ADDRESS) {
      const contract = new Contract(tokenAddress, ERC20.abi, provider);

      let balance: BigNumber;
      try {
        balance = await contract.functions.balanceOf(address);
      } catch (e) {
        throw Error(FAILED_TO_GET_ERC20_BALANCE(tokenAddress, address));
      }

      if (balance.lt(amount)) {
        throw Error(
          INSUFFICIENT_ERC20_FUNDS_TO_DEPOSIT(
            address,
            tokenAddress,
            amount,
            balance
          )
        );
      }
    } else {
      const balanceOfSigner = await provider.getBalance(address);

      if (balanceOfSigner.lt(amount)) {
        throw Error(`${INSUFFICIENT_FUNDS}: ${address}`);
      }
    }
  }

  protected async executeMethodImplementation(
    requestHandler: RequestHandler,
    params: Node.DepositParams
  ): Promise<Node.DepositResult> {
    const { outgoing, provider } = requestHandler;
    const { multisigAddress, tokenAddress } = params;

    params.tokenAddress = tokenAddress || CONVENTION_FOR_ETH_TOKEN_ADDRESS;

    await installBalanceRefundApp(requestHandler, params);
    await makeDeposit(requestHandler, params);
    await uninstallBalanceRefundApp(requestHandler, params);

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

    const payload: DepositConfirmationMessage = {
      from: publicIdentifier,
      type: "DEPOSIT_CONFIRMED_EVENT" as NodeEvent,
      data: params
    };

    await messagingService.send(counterpartyAddress, payload);
    outgoing.emit("DEPOSIT_CONFIRMED_EVENT", payload);

    const multisigBalance =
      params.tokenAddress === CONVENTION_FOR_ETH_TOKEN_ADDRESS
        ? await provider.getBalance(multisigAddress)
        : await new Contract(
            tokenAddress!,
            ERC20.abi,
            provider
          ).functions.balanceOf(multisigAddress);

    return {
      multisigBalance,
      tokenAddress: params.tokenAddress!
    };
  }
}
