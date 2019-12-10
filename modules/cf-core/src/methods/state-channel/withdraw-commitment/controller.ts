import { jsonRpcMethod } from "rpc-server";

import { xkeyKthAddress } from "../../../machine";
import { RequestHandler } from "../../../request-handler";
import { Node } from "../../../types";
import { NodeController } from "../../controller";
import WithdrawController from "../withdraw/controller";
import { runWithdrawProtocol } from "../withdraw/operation";
import { getCreate2MultisigAddress } from "../../../utils";
import {
  INCORRECT_MULTISIG_ADDRESS,
  INVALID_FACTORY_ADDRESS
} from "../../errors";

// Note: This can't extend `WithdrawController` because the `methodName` static
// members of each class are incompatible.
export default class WithdrawCommitmentController extends NodeController {
  @jsonRpcMethod(Node.RpcMethodName.WITHDRAW_COMMITMENT)
  public executeMethod = super.executeMethod;

  protected async getRequiredLockNames(
    requestHandler: RequestHandler,
    params: Node.WithdrawCommitmentParams
  ): Promise<string[]> {
    return WithdrawController.getRequiredLockNames(requestHandler, params);
  }

  protected async beforeExecution(
    requestHandler: RequestHandler,
    params: Node.WithdrawCommitmentParams
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
    params: Node.WithdrawCommitmentParams
  ): Promise<Node.WithdrawCommitmentResult> {
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
