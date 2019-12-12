import { JsonRpcProvider, TransactionResponse } from "ethers/providers";
import { jsonRpcMethod } from "rpc-server";

import { CONVENTION_FOR_ETH_TOKEN_ADDRESS } from "../../../constants";
import { xkeyKthAddress } from "../../../machine";
import { RequestHandler } from "../../../request-handler";
import { Node, NODE_EVENTS } from "../../../types";
import { prettyPrintObject, getCreate2MultisigAddress } from "../../../utils";
import { NodeController } from "../../controller";
import {
  CANNOT_WITHDRAW,
  INCORRECT_MULTISIG_ADDRESS,
  INSUFFICIENT_FUNDS_TO_WITHDRAW,
  INVALID_FACTORY_ADDRESS,
  WITHDRAWAL_FAILED
} from "../../errors";

import { runWithdrawProtocol } from "./operation";

export default class WithdrawController extends NodeController {
  @jsonRpcMethod(Node.RpcMethodName.WITHDRAW)
  public executeMethod = super.executeMethod;

  public static async getRequiredLockNames(
    requestHandler: RequestHandler,
    params: Node.WithdrawParams
  ): Promise<string[]> {
    const { store, publicIdentifier, networkContext } = requestHandler;

    const stateChannel = await store.getStateChannel(params.multisigAddress);

    const tokenAddress =
      params.tokenAddress || CONVENTION_FOR_ETH_TOKEN_ADDRESS;

    if (
      stateChannel.hasBalanceRefundAppInstance(
        networkContext.CoinBalanceRefundApp,
        tokenAddress
      )
    ) {
      throw Error(CANNOT_WITHDRAW);
    }

    const senderBalance = stateChannel
      .getFreeBalanceClass()
      .getBalance(
        tokenAddress,
        stateChannel.getFreeBalanceAddrOf(publicIdentifier)
      );
    if (senderBalance.lt(params.amount)) {
      throw Error(
        INSUFFICIENT_FUNDS_TO_WITHDRAW(
          tokenAddress,
          params.amount,
          senderBalance
        )
      );
    }

    return [params.multisigAddress];
  }

  protected async beforeExecution(
    requestHandler: RequestHandler,
    params: Node.WithdrawParams
  ): Promise<void> {
    const { store, provider, networkContext } = requestHandler;
    const { multisigAddress } = params;

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
  }

  protected async executeMethodImplementation(
    requestHandler: RequestHandler,
    params: Node.WithdrawParams
  ): Promise<Node.WithdrawResult> {
    const {
      store,
      provider,
      wallet,
      publicIdentifier,
      blocksNeededForConfirmation,
      outgoing
    } = requestHandler;

    const { multisigAddress, recipient } = params;

    params.recipient = recipient || xkeyKthAddress(publicIdentifier, 0);

    await runWithdrawProtocol(requestHandler, params);

    const commitment = await store.getWithdrawalCommitment(multisigAddress);

    if (!commitment) {
      throw Error("No withdrawal commitment found");
    }

    if ((await provider.getCode(multisigAddress)) === "0x") {
      throw Error("Multisig has not been deployed");
    }

    const tx = {
      ...commitment,
      gasPrice: await provider.getGasPrice(),
      gasLimit: 300000
    };

    let txResponse: TransactionResponse;
    try {
      txResponse = await wallet.sendTransaction(tx);

      outgoing.emit("WITHDRAWAL_STARTED_EVENT", {
        from: publicIdentifier,
        type: "WITHDRAWAL_STARTED_EVENT",
        data: {
          params,
          txHash: txResponse.hash
        }
      });

      const txReceipt = await provider.waitForTransaction(
        txResponse.hash as string,
        blocksNeededForConfirmation
      );

      outgoing.emit("WITHDRAWAL_CONFIRMED_EVENT", {
        from: publicIdentifier,
        type: "WITHDRAWAL_CONFIRMED_EVENT",
        data: { txReceipt }
      });
    } catch (e) {
      outgoing.emit(NODE_EVENTS.WITHDRAWAL_FAILED_EVENT, {
        from: publicIdentifier,
        type: NODE_EVENTS.WITHDRAWAL_FAILED_EVENT,
        data: e.toString()
      });
      throw Error(`${WITHDRAWAL_FAILED}: ${prettyPrintObject(e)}`);
    }

    return {
      recipient: params.recipient,
      txHash: txResponse.hash!
    };
  }
}
