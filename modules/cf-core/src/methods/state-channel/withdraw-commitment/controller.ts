import { jsonRpcMethod } from "rpc-server";

import { xkeyKthAddress } from "../../../machine";
import { RequestHandler } from "../../../request-handler";
import { CFCoreTypes } from "../../../types";
import { NodeController } from "../../controller";
import WithdrawController from "../withdraw/controller";
import { runWithdrawProtocol } from "../withdraw/operation";
import { getCreate2MultisigAddress } from "../../../utils";
import {
  INCORRECT_MULTISIG_ADDRESS,
  INVALID_FACTORY_ADDRESS,
  CANNOT_WITHDRAW
} from "../../errors";
import { AddressZero } from "ethers/constants";

// Note: This can't extend `WithdrawController` because the `methodName` static
// members of each class are incompatible.
export default class WithdrawCommitmentController extends NodeController {
  @jsonRpcMethod(CFCoreTypes.RpcMethodNames.chan_withdrawCommitment)
  public executeMethod = super.executeMethod;

  protected async getRequiredLockNames(
    requestHandler: RequestHandler,
    params: CFCoreTypes.WithdrawCommitmentParams
  ): Promise<string[]> {
    return WithdrawController.getRequiredLockNames(requestHandler, params);
  }

  protected async beforeExecution(
    requestHandler: RequestHandler,
    params: CFCoreTypes.WithdrawCommitmentParams
  ): Promise<void> {
    const { store, provider, networkContext } = requestHandler;
    const { multisigAddress, tokenAddress } = params;

    const channel = await store.getStateChannel(multisigAddress);

    if (!channel.proxyFactoryAddress) {
      throw Error(INVALID_FACTORY_ADDRESS(channel.proxyFactoryAddress));
    }

    if (
      channel.hasBalanceRefundAppInstance(
        networkContext.CoinBalanceRefundApp,
        tokenAddress || AddressZero
      )
    ) {
      throw Error(CANNOT_WITHDRAW);
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
    params: CFCoreTypes.WithdrawCommitmentParams
  ): Promise<CFCoreTypes.WithdrawCommitmentResult> {
    const { store, publicIdentifier } = requestHandler;

    const { multisigAddress, recipient } = params;

    params.recipient = recipient || xkeyKthAddress(publicIdentifier, 0);

    await runWithdrawProtocol(requestHandler, params);

    const commitment = await store.getWithdrawalCommitment(multisigAddress);

    if (!commitment) {
      throw Error("No withdrawal commitment found");
    }

    return {
      transaction: commitment
    };
  }
}
