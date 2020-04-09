import {
  AppInstanceProposal,
  IStoreService,
  MethodNames,
  MethodParams,
  MethodResults,
  ProtocolNames,
  ProtocolParams,
  toBN,
  ChannelPubId,
  getAddressFromIdentifier,
} from "@connext/types";
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
  initiatorIdentifier: ChannelPubId,
): Promise<AppInstanceProposal> {
  const { appIdentityHash } = params;

  if (!appIdentityHash || !appIdentityHash.trim()) {
    throw new Error(NO_APP_IDENTITY_HASH_TO_INSTALL);
  }

  const proposal = await store.getAppProposal(appIdentityHash);
  if (!proposal) {
    throw new Error(NO_PROPOSED_APP_INSTANCE_FOR_APP_IDENTITY_HASH(appIdentityHash));
  }

  const json = await store.getStateChannelByAppIdentityHash(appIdentityHash);
  if (!json) {
    throw new Error(NO_STATE_CHANNEL_FOR_APP_IDENTITY_HASH(appIdentityHash));
  }
  const stateChannel = StateChannel.fromJson(json);

  await protocolRunner.initiateProtocol(ProtocolNames.install, {
    initiatorIdentifier,
    initiatorDepositAssetId: proposal.initiatorDepositAssetId,
    responderIdentifier:
      initiatorIdentifier === proposal.initiatorIdentifier
        ? proposal.responderIdentifier
        : proposal.initiatorIdentifier,
    initiatorBalanceDecrement: toBN(proposal.initiatorDeposit),
    responderBalanceDecrement: toBN(proposal.responderDeposit),
    multisigAddress: stateChannel.multisigAddress,
    initialState: proposal.initialState,
    appInterface: {
      ...proposal.abiEncodings,
      addr: proposal.appDefinition,
    },
    appSeqNo: proposal.appSeqNo,
    defaultTimeout: toBN(proposal.defaultTimeout),
    outcomeType: proposal.outcomeType,
    responderDepositAssetId: proposal.responderDepositAssetId,
    disableLimit: false,
    meta: proposal.meta,
    stateTimeout: toBN(proposal.stateTimeout),
    appInitiatorIdentifier: proposal.initiatorIdentifier,
    appResponderIdentifier: proposal.responderIdentifier,
  } as ProtocolParams.Install);
  
  stateChannel.removeProposal(appIdentityHash);
  await store.removeAppProposal(stateChannel.multisigAddress, proposal.identityHash);

  return proposal;
}
