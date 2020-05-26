import {
  MethodNames,
  MethodParams,
  MethodResults,
  ProtocolNames,
  CONVENTION_FOR_ETH_ASSET_ID,
} from "@connext/types";

import {
  NULL_INITIAL_STATE_FOR_PROPOSAL,
  NO_STATE_CHANNEL_FOR_OWNERS,
  NO_MULTISIG_IN_PARAMS,
} from "../../errors";
import { StateChannel } from "../../models";
import { RequestHandler } from "../../request-handler";

import { MethodController } from "../controller";

/**
 * This creates an entry of a proposed AppInstance while sending the proposal
 * to the peer with whom this AppInstance is specified to be installed.
 *
 * @returns The appIdentityHash for the proposed AppInstance
 */
export class ProposeInstallAppInstanceController extends MethodController {
  public readonly methodName = MethodNames.chan_proposeInstall;

  public executeMethod = super.executeMethod;

  protected async getRequiredLockName(
    requestHandler: RequestHandler,
    params: MethodParams.ProposeInstall,
  ): Promise<string> {
    if (!params.multisigAddress) {
      throw new Error(NO_MULTISIG_IN_PARAMS(params));
    }
    return params.multisigAddress;
  }

  protected async beforeExecution(
    requestHandler: RequestHandler,
    params: MethodParams.ProposeInstall,
    preProtocolStateChannel: StateChannel | undefined,
  ): Promise<void> {
    const { initialState, responderIdentifier } = params;
    const { publicIdentifier } = requestHandler;

    if (!initialState) {
      throw new Error(NULL_INITIAL_STATE_FOR_PROPOSAL);
    }

    if (!preProtocolStateChannel) {
      throw new Error(
        NO_STATE_CHANNEL_FOR_OWNERS([publicIdentifier, responderIdentifier].toString()),
      );
    }

    const {
      initiatorDepositAssetId: initiatorDepositAssetIdParam,
      responderDepositAssetId: responderDepositAssetIdParam,
    } = params;

    const initiatorDepositAssetId = initiatorDepositAssetIdParam || CONVENTION_FOR_ETH_ASSET_ID;

    const responderDepositAssetId = responderDepositAssetIdParam || CONVENTION_FOR_ETH_ASSET_ID;

    params.initiatorDepositAssetId = initiatorDepositAssetId;
    params.responderDepositAssetId = responderDepositAssetId;
  }

  protected async executeMethodImplementation(
    requestHandler: RequestHandler,
    params: MethodParams.ProposeInstall,
    preProtocolStateChannel: StateChannel | undefined,
  ): Promise<MethodResults.ProposeInstall> {
    const { protocolRunner, publicIdentifier, router } = requestHandler;

    const { responderIdentifier, stateTimeout, defaultTimeout } = params;

    const { channel: updated }: { channel: StateChannel } = await protocolRunner.initiateProtocol(
      router,
      ProtocolNames.propose,
      {
        ...params,
        stateTimeout: stateTimeout || defaultTimeout,
        initiatorIdentifier: publicIdentifier,
        responderIdentifier: responderIdentifier,
      },
      preProtocolStateChannel!,
    );
    return { appIdentityHash: updated.mostRecentlyProposedAppInstance().identityHash };
  }
}
