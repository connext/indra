import {
  MethodNames, MethodParams, MethodResults, ProtocolNames,
} from "@connext/types";
import { jsonRpcMethod } from "rpc-server";

import { CONVENTION_FOR_ETH_TOKEN_ADDRESS } from "../../constants";
import {
  NULL_INITIAL_STATE_FOR_PROPOSAL,
} from "../../errors";
import { RequestHandler } from "../../request-handler";

import { NodeController } from "../controller";

/**
 * This creates an entry of a proposed AppInstance while sending the proposal
 * to the peer with whom this AppInstance is specified to be installed.
 *
 * @returns The AppInstanceId for the proposed AppInstance
 */
export class ProposeInstallAppInstanceController extends NodeController {
  @jsonRpcMethod(MethodNames.chan_proposeInstall)
  public executeMethod = super.executeMethod;

  protected async getRequiredLockNames(
    requestHandler: RequestHandler,
    params: MethodParams.ProposeInstall,
  ): Promise<string[]> {
    const { networkContext, publicIdentifier, store } = requestHandler;
    const { proposedToIdentifier } = params;

    const multisigAddress = await store.getMultisigAddressWithCounterparty(
      [publicIdentifier, proposedToIdentifier],
      networkContext.ProxyFactory,
      networkContext.MinimumViableMultisig,
      networkContext.provider,
    );

    return [multisigAddress];
  }

  protected async beforeExecution(
    requestHandler: RequestHandler,
    params: MethodParams.ProposeInstall,
  ): Promise<void> {
    const { initialState } = params;

    if (!initialState) {
      throw new Error(NULL_INITIAL_STATE_FOR_PROPOSAL);
    }

    const {
      initiatorDepositTokenAddress: initiatorDepositTokenAddressParam,
      responderDepositTokenAddress: responderDepositTokenAddressParam,
    } = params;

    const initiatorDepositTokenAddress =
      initiatorDepositTokenAddressParam || CONVENTION_FOR_ETH_TOKEN_ADDRESS;

    const responderDepositTokenAddress =
      responderDepositTokenAddressParam || CONVENTION_FOR_ETH_TOKEN_ADDRESS;

    params.initiatorDepositTokenAddress = initiatorDepositTokenAddress;
    params.responderDepositTokenAddress = responderDepositTokenAddress;
  }

  protected async executeMethodImplementation(
    requestHandler: RequestHandler,
    params: MethodParams.ProposeInstall,
  ): Promise<MethodResults.ProposeInstall> {
    const { networkContext, protocolRunner, publicIdentifier, store } = requestHandler;

    const { proposedToIdentifier } = params;

    // see comment in `getRequiredLockNames`
    const multisigAddress = await store.getMultisigAddressWithCounterparty(
      [publicIdentifier, proposedToIdentifier],
      networkContext.ProxyFactory,
      networkContext.MinimumViableMultisig,
      networkContext.provider,
    );

    await protocolRunner.initiateProtocol(ProtocolNames.propose, {
      ...params,
      multisigAddress,
      initiatorXpub: publicIdentifier,
      responderXpub: proposedToIdentifier,
    });

    return {
      appInstanceId: (
        await store.getStateChannel(multisigAddress)
      ).mostRecentlyProposedAppInstance().identityHash,
    };
  }
}
