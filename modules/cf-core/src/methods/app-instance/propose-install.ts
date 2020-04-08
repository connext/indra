import {
  MethodNames,
  MethodParams,
  MethodResults,
  ProtocolNames,
  getChainIdFromIdentifier,
  getAssetId,
} from "@connext/types";
import { jsonRpcMethod } from "rpc-server";

import {
  NULL_INITIAL_STATE_FOR_PROPOSAL, NO_STATE_CHANNEL_FOR_OWNERS,
} from "../../errors";
import { RequestHandler } from "../../request-handler";

import { NodeController } from "../controller";
import { StateChannel } from "../../models";

/**
 * This creates an entry of a proposed AppInstance while sending the proposal
 * to the peer with whom this AppInstance is specified to be installed.
 *
 * @returns The appIdentityHash for the proposed AppInstance
 */
export class ProposeInstallAppInstanceController extends NodeController {
  @jsonRpcMethod(MethodNames.chan_proposeInstall)
  public executeMethod = super.executeMethod;

  protected async getRequiredLockNames(
    requestHandler: RequestHandler,
    params: MethodParams.ProposeInstall,
  ): Promise<string[]> {
    const { publicIdentifier, store } = requestHandler;
    const { proposedToIdentifier } = params;

    const json = await store.getStateChannelByOwners([publicIdentifier, proposedToIdentifier]);
    if (!json) {
      throw new Error(NO_STATE_CHANNEL_FOR_OWNERS([
        publicIdentifier,
        proposedToIdentifier,
      ].toString()));
    }

    return [json.multisigAddress];
  }

  protected async beforeExecution(
    requestHandler: RequestHandler,
    params: MethodParams.ProposeInstall,
  ): Promise<void> {
    const { initialState } = params;
    const { publicIdentifier } = requestHandler;

    const chainId = getChainIdFromIdentifier(publicIdentifier);

    if (!initialState) {
      throw new Error(NULL_INITIAL_STATE_FOR_PROPOSAL);
    }

    const {
      initiatorDepositTokenAddress: initiatorDepositTokenAddressParam,
      responderDepositTokenAddress: responderDepositTokenAddressParam,
    } = params;

    const initiatorDepositTokenAddress =
      initiatorDepositTokenAddressParam || getAssetId(chainId);

    const responderDepositTokenAddress =
      responderDepositTokenAddressParam || getAssetId(chainId);

    params.initiatorDepositTokenAddress = initiatorDepositTokenAddress;
    params.responderDepositTokenAddress = responderDepositTokenAddress;
  }

  protected async executeMethodImplementation(
    requestHandler: RequestHandler,
    params: MethodParams.ProposeInstall,
  ): Promise<MethodResults.ProposeInstall> {
    const { protocolRunner, publicIdentifier, store } = requestHandler;

    const { proposedToIdentifier, stateTimeout, defaultTimeout } = params;

    const json = await store.getStateChannelByOwners([publicIdentifier, proposedToIdentifier]);
    if (!json) {
      throw new Error(NO_STATE_CHANNEL_FOR_OWNERS([
        publicIdentifier,
        proposedToIdentifier,
      ].toString()));
    }

    await protocolRunner.initiateProtocol(ProtocolNames.propose, {
      ...params,
      stateTimeout: stateTimeout || defaultTimeout,
      multisigAddress: json.multisigAddress,
      initiatorIdentifier: publicIdentifier,
      responderIdentifier: proposedToIdentifier,
    });

    const updated = await store.getStateChannel(json.multisigAddress);

    return {
      appIdentityHash: StateChannel
        .fromJson(updated!)
        .mostRecentlyProposedAppInstance()
        .identityHash,
    };
  }
}
