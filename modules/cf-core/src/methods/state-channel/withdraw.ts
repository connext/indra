import { MethodNames, MethodParams, MethodResults, ProtocolNames } from "@connext/types";
import {
  WITHDRAWAL_STARTED_EVENT,
  WITHDRAWAL_FAILED_EVENT,
  WITHDRAWAL_CONFIRMED_EVENT,
} from "@connext/types";
import { TransactionResponse } from "ethers/providers";
import { jsonRpcMethod } from "rpc-server";

import { CONVENTION_FOR_ETH_TOKEN_ADDRESS } from "../../constants";
import {
  CANNOT_WITHDRAW,
  INCORRECT_MULTISIG_ADDRESS,
  INSUFFICIENT_FUNDS_TO_WITHDRAW,
  INVALID_FACTORY_ADDRESS,
  INVALID_MASTERCOPY_ADDRESS,
  WITHDRAWAL_FAILED,
} from "../../errors";
import { StateChannel } from "../../models";
import { RequestHandler } from "../../request-handler";
import { getCreate2MultisigAddress } from "../../utils";
import { xkeyKthAddress } from "../../xkeys";

import { NodeController } from "../controller";

export class WithdrawController extends NodeController {
  @jsonRpcMethod(MethodNames.chan_withdraw)
  public executeMethod = super.executeMethod;

  public static async getRequiredLockNames(
    requestHandler: RequestHandler,
    params: MethodParams.Withdraw,
  ): Promise<string[]> {
    const { store, publicIdentifier, networkContext } = requestHandler;

    const stateChannel = await store.getStateChannel(params.multisigAddress);

    const tokenAddress = params.tokenAddress || CONVENTION_FOR_ETH_TOKEN_ADDRESS;

    if (
      stateChannel.hasBalanceRefundAppInstance(networkContext.CoinBalanceRefundApp, tokenAddress)
    ) {
      throw Error(CANNOT_WITHDRAW);
    }

    const senderBalance = stateChannel
      .getFreeBalanceClass()
      .getBalance(tokenAddress, stateChannel.getFreeBalanceAddrOf(publicIdentifier));
    if (senderBalance.lt(params.amount)) {
      throw Error(INSUFFICIENT_FUNDS_TO_WITHDRAW(tokenAddress, params.amount, senderBalance));
    }

    return [params.multisigAddress];
  }

  protected async beforeExecution(
    requestHandler: RequestHandler,
    params: MethodParams.Withdraw,
  ): Promise<void> {
    const { store, provider } = requestHandler;
    const { multisigAddress } = params;

    const channel = await store.getStateChannel(multisigAddress);

    if (!channel.addresses.proxyFactory) {
      throw Error(INVALID_FACTORY_ADDRESS(channel.addresses.proxyFactory));
    }

    if (!channel.addresses.multisigMastercopy) {
      throw Error(INVALID_MASTERCOPY_ADDRESS(channel.addresses.multisigMastercopy));
    }

    const expectedMultisigAddress = await getCreate2MultisigAddress(
      channel.userNeuteredExtendedKeys,
      channel.addresses,
      provider,
    );

    if (expectedMultisigAddress !== channel.multisigAddress) {
      throw Error(INCORRECT_MULTISIG_ADDRESS);
    }
  }

  protected async executeMethodImplementation(
    requestHandler: RequestHandler,
    params: MethodParams.Withdraw,
  ): Promise<MethodResults.Withdraw> {
    const {
      store,
      provider,
      wallet,
      publicIdentifier,
      blocksNeededForConfirmation,
      outgoing,
    } = requestHandler;

    const { multisigAddress, recipient } = params;

    const signer = await requestHandler.getSigner();
    const signerAddress = await signer.getAddress();
    const nonce = await provider.getTransactionCount(signerAddress);

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
      gasLimit: 300000,
      nonce,
    };

    let txResponse: TransactionResponse;
    try {
      txResponse = await wallet.sendTransaction(tx);

      outgoing.emit(WITHDRAWAL_STARTED_EVENT, {
        from: publicIdentifier,
        type: WITHDRAWAL_STARTED_EVENT,
        data: {
          params,
          txHash: txResponse.hash,
        },
      });

      const txReceipt = await provider.waitForTransaction(
        txResponse.hash as string,
        blocksNeededForConfirmation,
      );

      outgoing.emit(WITHDRAWAL_CONFIRMED_EVENT, {
        from: publicIdentifier,
        type: WITHDRAWAL_CONFIRMED_EVENT,
        data: { txReceipt },
      });
    } catch (e) {
      outgoing.emit(WITHDRAWAL_FAILED_EVENT, {
        from: publicIdentifier,
        type: WITHDRAWAL_FAILED_EVENT,
        data: e.toString(),
      });
      throw Error(`${WITHDRAWAL_FAILED}: ${e.message}`);
    }

    return {
      recipient: params.recipient,
      txHash: txResponse.hash!,
    };
  }
}

export async function runWithdrawProtocol(
  requestHandler: RequestHandler,
  params: MethodParams.Withdraw,
) {
  const { publicIdentifier, protocolRunner, store } = requestHandler;
  const { multisigAddress, amount } = params;

  const tokenAddress = params.tokenAddress || CONVENTION_FOR_ETH_TOKEN_ADDRESS;

  const [peerAddress] = await StateChannel.getPeersAddressFromChannel(
    publicIdentifier,
    store,
    multisigAddress,
  );

  const stateChannel = await store.getStateChannel(multisigAddress);

  await protocolRunner.initiateProtocol(ProtocolNames.withdraw, {
    amount,
    tokenAddress,
    recipient: params.recipient as string,
    initiatorXpub: publicIdentifier,
    responderXpub: peerAddress,
    multisigAddress: stateChannel.multisigAddress,
  });
}
