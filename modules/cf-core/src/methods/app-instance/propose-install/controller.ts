import { jsonRpcMethod } from "rpc-server";

import { CONVENTION_FOR_ETH_TOKEN_ADDRESS } from "../../../constants";
import { Protocol } from "../../../machine";
import { RequestHandler } from "../../../request-handler";
import { CFCoreTypes, ProtocolTypes } from "../../../types";
import { NodeController } from "../../controller";
import { NULL_INITIAL_STATE_FOR_PROPOSAL } from "../../errors";

/**
 * This creates an entry of a proposed AppInstance while sending the proposal
 * to the peer with whom this AppInstance is specified to be installed.
 *
 * @returns The AppInstanceId for the proposed AppInstance
 */
export default class ProposeInstallController extends NodeController {
  @jsonRpcMethod(ProtocolTypes.chan_proposeInstall)
  public executeMethod: (
    requestHandler: RequestHandler,
    params: CFCoreTypes.MethodParams,
  ) => Promise<CFCoreTypes.MethodResult> = super.executeMethod;

  protected async getRequiredLockNames(
    requestHandler: RequestHandler,
    params: CFCoreTypes.ProposeInstallParams,
  ): Promise<string[]> {
    const { networkContext, publicIdentifier, store } = requestHandler;
    const { proposedToIdentifier } = params;

    // no way to determine if this is a virtual or regular app being
    // proposed. because it may be a virtual app, and the function defaults
    // to pulling from the store, assume it is okay to use a generated
    // multisig

    // in practice, the only time it should *not* find the multisig
    // address in the store is if its a virtual app being proposed between
    // two new respondents. Unfortunately, we cannot affirm this before
    // generating the queues
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
    params: CFCoreTypes.ProposeInstallParams,
  ): Promise<void> {
    const { initialState } = params;

    if (!initialState) {
      throw Error(NULL_INITIAL_STATE_FOR_PROPOSAL);
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
    params: CFCoreTypes.ProposeInstallParams,
  ): Promise<CFCoreTypes.ProposeInstallResult> {
    const { networkContext, protocolRunner, publicIdentifier, store } = requestHandler;

    const { proposedToIdentifier } = params;

    // see comment in `getRequiredLockNames`
    const multisigAddress = await store.getMultisigAddressWithCounterparty(
      [publicIdentifier, proposedToIdentifier],
      networkContext.ProxyFactory,
      networkContext.MinimumViableMultisig,
      networkContext.provider,
    );

    await protocolRunner.initiateProtocol(Protocol.Propose, {
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
