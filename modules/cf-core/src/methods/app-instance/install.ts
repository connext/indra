import {
  AppInstanceProposal,
  IStoreService,
  MethodNames,
  MethodParams,
  MethodResults,
  ProtocolNames,
  ProtocolParams,
  PublicIdentifier,
} from "@connext/types";
import { toBN } from "@connext/utils";
import { jsonRpcMethod } from "rpc-server";

import {
  NO_APP_IDENTITY_HASH_TO_INSTALL,
  NO_STATE_CHANNEL_FOR_APP_IDENTITY_HASH,
  NO_PROPOSED_APP_INSTANCE_FOR_APP_IDENTITY_HASH,
} from "../../errors";
import { ProtocolRunner } from "../../machine";
import { RequestHandler } from "../../request-handler";
import { NodeController } from "../controller";
import { StateChannel } from "../../models";

/**
 * This converts a proposed app instance to an installed app instance while
 * sending an approved ack to the proposer.
 * @param params
 */
export class InstallAppInstanceController extends NodeController {
  @jsonRpcMethod(MethodNames.chan_install)
  public executeMethod = super.executeMethod;

  protected async getRequiredLockNames(
    requestHandler: RequestHandler,
    params: MethodParams.Install,
  ): Promise<string[]> {
    const { store } = requestHandler;
    const { appIdentityHash } = params;

    const sc = await store.getStateChannelByAppIdentityHash(appIdentityHash);
    if (!sc) {
      throw new Error(NO_STATE_CHANNEL_FOR_APP_IDENTITY_HASH(appIdentityHash));
    }

    return [sc.multisigAddress];
  }

  protected async beforeExecution(
    requestHandler: RequestHandler,
    params: MethodParams.Install,
  ): Promise<void> {
    await requestHandler.addChannelToRequestHandler(params);
    if (!requestHandler.channel) {
      throw new Error(NO_STATE_CHANNEL_FOR_APP_IDENTITY_HASH(params.appIdentityHash));
    }

    const { appIdentityHash } = params;

    if (!appIdentityHash || !appIdentityHash.trim()) {
      throw new Error(NO_APP_IDENTITY_HASH_TO_INSTALL);
    }

    const proposal = requestHandler.channel.proposedAppInstances.get(appIdentityHash);
    if (!proposal) {
      throw new Error(NO_PROPOSED_APP_INSTANCE_FOR_APP_IDENTITY_HASH(appIdentityHash));
    }
  }

  protected async executeMethodImplementation(
    requestHandler: RequestHandler,
    params: MethodParams.Install,
  ): Promise<MethodResults.Install> {
    const { channel, protocolRunner, publicIdentifier } = requestHandler;

    console.log(`CALLING INSTALL PROTOCOL`);
    const postProtocolChannel = await install(channel!, protocolRunner, params, publicIdentifier);
    console.log(`INSTALL PROTOCOL COMPLETE`);

    const appInstance = postProtocolChannel.appInstances.get(params.appIdentityHash);
    if (!appInstance) {
      throw new Error(
        `Cannot find app instance after install protocol run for hash ${params.appIdentityHash}`,
      );
    }

    return {
      appInstance: appInstance.toJson(),
    };
  }
}

export async function install(
  preProtocolStateChannel: StateChannel,
  protocolRunner: ProtocolRunner,
  params: MethodParams.Install,
  initiatorIdentifier: PublicIdentifier,
): Promise<StateChannel> {
  const proposal = preProtocolStateChannel.proposedAppInstances.get(params.appIdentityHash)!;
  const isSame = initiatorIdentifier === proposal.initiatorIdentifier;

  const { channel: postProtocolChannel } = await protocolRunner.initiateProtocol(
    ProtocolNames.install,
    {
      appInitiatorIdentifier: proposal.initiatorIdentifier,
      appInterface: { ...proposal.abiEncodings, addr: proposal.appDefinition },
      appResponderIdentifier: proposal.responderIdentifier,
      appSeqNo: proposal.appSeqNo,
      defaultTimeout: toBN(proposal.defaultTimeout),
      disableLimit: false,
      initialState: proposal.initialState,
      initiatorBalanceDecrement: isSame
        ? toBN(proposal.initiatorDeposit)
        : toBN(proposal.responderDeposit),
      initiatorDepositAssetId: isSame
        ? proposal.initiatorDepositAssetId
        : proposal.responderDepositAssetId,
      initiatorIdentifier,
      meta: proposal.meta,
      multisigAddress: preProtocolStateChannel.multisigAddress,
      outcomeType: proposal.outcomeType,
      responderBalanceDecrement: isSame
        ? toBN(proposal.responderDeposit)
        : toBN(proposal.initiatorDeposit),
      responderDepositAssetId: isSame
        ? proposal.responderDepositAssetId
        : proposal.initiatorDepositAssetId,
      responderIdentifier: isSame ? proposal.responderIdentifier : proposal.initiatorIdentifier,
      stateTimeout: toBN(proposal.stateTimeout),
    } as ProtocolParams.Install,
  );

  return postProtocolChannel;
}
