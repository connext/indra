import { AddressZero } from "ethers/constants";
import { jsonRpcMethod } from "rpc-server";

import {
  CANNOT_WITHDRAW,
  INCORRECT_MULTISIG_ADDRESS,
  INVALID_FACTORY_ADDRESS,
  INVALID_MASTERCOPY_ADDRESS,
} from "../../errors";
import { RequestHandler } from "../../request-handler";
import {
  MethodNames,
  WithdrawCommitmentParams,
  WithdrawCommitmentResult,
} from "../../types";
import { getCreate2MultisigAddress } from "../../utils";
import { xkeyKthAddress } from "../../xkeys";

import { NodeController } from "../controller";

import { runWithdrawProtocol, WithdrawController } from "./withdraw";

// Note: This can't extend `WithdrawController` because the `methodName` static
// members of each class are incompatible.
export class WithdrawCommitmentController extends NodeController {
  @jsonRpcMethod(MethodNames.chan_withdrawCommitment)
  public executeMethod = super.executeMethod;

  protected async getRequiredLockNames(
    requestHandler: RequestHandler,
    params: WithdrawCommitmentParams,
  ): Promise<string[]> {
    return WithdrawController.getRequiredLockNames(requestHandler, params);
  }

  protected async beforeExecution(
    requestHandler: RequestHandler,
    params: WithdrawCommitmentParams,
  ): Promise<void> {
    const { store, provider, networkContext } = requestHandler;
    const { multisigAddress, tokenAddress } = params;

    const channel = await store.getStateChannel(multisigAddress);

    if (!channel.addresses.proxyFactory) {
      throw Error(INVALID_FACTORY_ADDRESS(channel.addresses.proxyFactory));
    }

    if (!channel.addresses.multisigMastercopy) {
      throw Error(INVALID_MASTERCOPY_ADDRESS(channel.addresses.multisigMastercopy));
    }

    if (
      channel.hasBalanceRefundAppInstance(
        networkContext.CoinBalanceRefundApp,
        tokenAddress || AddressZero,
      )
    ) {
      throw Error(CANNOT_WITHDRAW);
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
    params: WithdrawCommitmentParams,
  ): Promise<WithdrawCommitmentResult> {
    const { store, publicIdentifier } = requestHandler;

    const { multisigAddress, recipient } = params;

    params.recipient = recipient || xkeyKthAddress(publicIdentifier, 0);

    await runWithdrawProtocol(requestHandler, params);

    const commitment = await store.getWithdrawalCommitment(multisigAddress);

    if (!commitment) {
      throw Error("No withdrawal commitment found");
    }

    return {
      transaction: commitment,
    };
  }
}
