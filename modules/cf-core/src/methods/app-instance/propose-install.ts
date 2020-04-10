import {
  MethodNames,
  MethodParams,
  MethodResults,
  ProtocolNames,
  getChainIdFromPublicIdentifier,
  getAssetId,
} from "@connext/types";
import { AddressZero } from "ethers/constants";
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
    const { responderIdentifier } = params;

    const json = await store.getStateChannelByOwners([publicIdentifier, responderIdentifier]);
    if (!json) {
      throw new Error(NO_STATE_CHANNEL_FOR_OWNERS([
        publicIdentifier,
        responderIdentifier,
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

    const chainId = getChainIdFromPublicIdentifier(publicIdentifier);

    if (!initialState) {
      throw new Error(NULL_INITIAL_STATE_FOR_PROPOSAL);
    }

    const {
      initiatorDepositAssetId: initiatorDepositAssetIdParam,
      responderDepositAssetId: responderDepositAssetIdParam,
    } = params;

    const initiatorDepositAssetId =
      initiatorDepositAssetIdParam || getAssetId(AddressZero, chainId);

    const responderDepositAssetId =
      responderDepositAssetIdParam || getAssetId(AddressZero, chainId);

    params.initiatorDepositAssetId = initiatorDepositAssetId;
    params.responderDepositAssetId = responderDepositAssetId;
  }

  protected async executeMethodImplementation(
    requestHandler: RequestHandler,
    params: MethodParams.ProposeInstall,
  ): Promise<MethodResults.ProposeInstall> {
    const { protocolRunner, publicIdentifier, store } = requestHandler;

    const { responderIdentifier, stateTimeout, defaultTimeout } = params;

    const json = await store.getStateChannelByOwners([publicIdentifier, responderIdentifier]);
    if (!json) {
      throw new Error(NO_STATE_CHANNEL_FOR_OWNERS([
        publicIdentifier,
        responderIdentifier,
      ].toString()));
    }

    await protocolRunner.initiateProtocol(ProtocolNames.propose, {
      ...params,
      stateTimeout: stateTimeout || defaultTimeout,
      multisigAddress: json.multisigAddress,
      initiatorIdentifier: publicIdentifier,
      responderIdentifier: responderIdentifier,
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
