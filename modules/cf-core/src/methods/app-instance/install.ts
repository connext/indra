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

    const result = [sc.multisigAddress];
    requestHandler.log.newContext("InstallMethod").info(`Acquiring locks: [${result}]`);
    return result;
  }

  protected async executeMethodImplementation(
    requestHandler: RequestHandler,
    params: MethodParams.Install,
  ): Promise<MethodResults.Install> {
    const { store, protocolRunner, publicIdentifier } = requestHandler;
    requestHandler.log.newContext("InstallMethod").info(
      `Called w params: ${JSON.stringify(params)}`,
    );

    const appInstanceProposal = await install(store, protocolRunner, params, publicIdentifier);

    const appInstance = await store.getAppInstance(appInstanceProposal.identityHash);
    if (!appInstance) {
      throw new Error(
        `Cannot find app instance after install protocol run for hash ${appInstanceProposal.identityHash}`,
      );
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
  initiatorIdentifier: PublicIdentifier,
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

  const isSame = initiatorIdentifier === proposal.initiatorIdentifier;

  await protocolRunner.initiateProtocol(ProtocolNames.install, {
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
    multisigAddress: stateChannel.multisigAddress,
    outcomeType: proposal.outcomeType,
    responderBalanceDecrement: isSame
      ? toBN(proposal.responderDeposit)
      : toBN(proposal.initiatorDeposit),
    responderDepositAssetId: isSame
      ? proposal.responderDepositAssetId
      : proposal.initiatorDepositAssetId,
    responderIdentifier: isSame ? proposal.responderIdentifier : proposal.initiatorIdentifier,
    stateTimeout: toBN(proposal.stateTimeout),
  } as ProtocolParams.Install);

  return proposal;
}
