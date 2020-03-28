import { MethodNames, MethodParams, MethodResults, ProtocolNames, IStoreService } from "@connext/types";
import { bigNumberify } from "ethers/utils";
import { jsonRpcMethod } from "rpc-server";

import { NO_APP_INSTANCE_ID_TO_INSTALL, NO_STATE_CHANNEL_FOR_APP_INSTANCE_ID, NO_PROPOSED_APP_INSTANCE_FOR_APP_INSTANCE_ID } from "../../errors";
import { ProtocolRunner } from "../../machine";
import { RequestHandler } from "../../request-handler";
import {
  AppInstanceProposal,
} from "../../types";
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
    const { appInstanceId } = params;

    const sc = await store.getStateChannelByAppInstanceId(appInstanceId);
    if (!sc) {
      throw new Error(NO_STATE_CHANNEL_FOR_APP_INSTANCE_ID(appInstanceId));
    }

    return [sc.multisigAddress];
  }

  protected async executeMethodImplementation(
    requestHandler: RequestHandler,
    params: MethodParams.Install,
  ): Promise<MethodResults.Install> {
    const { store, protocolRunner, publicIdentifier } = requestHandler;

    const appInstanceProposal = await install(store, protocolRunner, params, publicIdentifier);

    const appInstance = await store.getAppInstance(appInstanceProposal.identityHash);
    if (!appInstance) {
      throw new Error(`Cannot find app instance after install protocol run for hash ${appInstanceProposal.identityHash}`);
    }

    return {
      appInstance,
    };
  }
}

export async function install(
  store: IStoreService,
  protocolRunner: ProtocolRunner,
  params: MethodParams.Install,
  initiatorXpub: string,
): Promise<AppInstanceProposal> {
  const { appInstanceId } = params;

  if (!appInstanceId || !appInstanceId.trim()) {
    throw new Error(NO_APP_INSTANCE_ID_TO_INSTALL);
  }

  const proposal = await store.getAppProposal(appInstanceId);
  if (!proposal) {
    throw new Error(NO_PROPOSED_APP_INSTANCE_FOR_APP_INSTANCE_ID(appInstanceId));
  }

  const json = await store.getStateChannelByAppInstanceId(appInstanceId);
  if (!json) {
    throw new Error(NO_STATE_CHANNEL_FOR_APP_INSTANCE_ID(appInstanceId));
  }
  const stateChannel = StateChannel.fromJson(json);

  await protocolRunner.initiateProtocol(ProtocolNames.install, {
    initiatorXpub,
    responderXpub:
      initiatorXpub === proposal.proposedToIdentifier
        ? proposal.proposedByIdentifier
        : proposal.proposedToIdentifier,
    initiatorBalanceDecrement: bigNumberify(proposal.initiatorDeposit),
    responderBalanceDecrement: bigNumberify(proposal.responderDeposit),
    multisigAddress: stateChannel.multisigAddress,
    participants: stateChannel.getSigningKeysFor(proposal.appSeqNo),
    initialState: proposal.initialState,
    appInterface: {
      ...proposal.abiEncodings,
      addr: proposal.appDefinition,
    },
    appSeqNo: proposal.appSeqNo,
    defaultTimeout: bigNumberify(proposal.timeout).toNumber(),
    outcomeType: proposal.outcomeType,
    initiatorDepositTokenAddress: proposal.initiatorDepositTokenAddress,
    responderDepositTokenAddress: proposal.responderDepositTokenAddress,
    disableLimit: false,
  });
  stateChannel.removeProposal(appInstanceId);
  await store.removeAppProposal(stateChannel.multisigAddress, proposal.identityHash);

  return proposal;
}
