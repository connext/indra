import {
  bigNumberifyJson,
  EventEmittedMessage,
  EventNames,
  IStoreService,
  NetworkContext,
  NodeMessageWrappedProtocolMessage,
  ProtocolName,
  ProtocolNames,
  ProtocolParam,
  ProtocolParams,
  SolidityValueType,
} from "@connext/types";

import { UNASSIGNED_SEQ_NO } from "../constants";
import { NO_STATE_CHANNEL_FOR_MULTISIG_ADDR } from "../errors";

import { RequestHandler } from "../request-handler";
import RpcRouter from "../rpc-router";
import { StateChannel, AppInstance } from "../models";

/**
 * Forwards all received NodeMessages that are for the machine's internal
 * protocol execution directly to the protocolRunner's message handler:
 * `runProtocolWithMessage`
 */
export async function handleReceivedProtocolMessage(
  requestHandler: RequestHandler,
  msg: NodeMessageWrappedProtocolMessage,
) {
  const { protocolRunner, store, router, networkContext, publicIdentifier } = requestHandler;

  const { data } = bigNumberifyJson(msg) as NodeMessageWrappedProtocolMessage;

  const { protocol, seq, params } = data;

  if (seq === UNASSIGNED_SEQ_NO) return;

  await protocolRunner.runProtocolWithMessage(data);

  const outgoingEventData = await getOutgoingEventDataFromProtocol(
    protocol,
    params!,
    networkContext,
    store,
    publicIdentifier,
  );

  if (!outgoingEventData) {
    return;
  }

  if (protocol !== ProtocolNames.install) {
    await emitOutgoingNodeMessage(router, outgoingEventData);
    return;
  }

  const appIdentityHash =
      outgoingEventData!.data["appIdentityHash"] ||
      (outgoingEventData!.data as any).params["appIdentityHash"];

  if (!appIdentityHash) {
    await emitOutgoingNodeMessage(router, outgoingEventData);
    return;
  }

  const proposal = await store.getAppProposal(appIdentityHash);
  if (!proposal) {
    await emitOutgoingNodeMessage(router, outgoingEventData);
    return;
  }

  // remove proposal from channel and store
  const json = await store.getStateChannelByAppIdentityHash(appIdentityHash);
  if (!json) {
    throw new Error(`Could not find channel for app instance ${appIdentityHash} when processing install protocol message`);
  }
  const channel = StateChannel.fromJson(json).removeProposal(proposal.identityHash);
  await store.removeAppProposal(channel.multisigAddress, proposal.identityHash);

  // finally, emit message
  await emitOutgoingNodeMessage(router, outgoingEventData);
}

function emitOutgoingNodeMessage(router: RpcRouter, msg: EventEmittedMessage) {
  return router.emit(msg["type"], msg, "outgoing");
}

async function getOutgoingEventDataFromProtocol(
  protocol: ProtocolName,
  params: ProtocolParam,
  networkContext: NetworkContext,
  store: IStoreService,
  publicIdentifier: string,
): Promise<EventEmittedMessage | undefined> {
  // default to the pubId that initiated the protocol
  const baseEvent = { from: params.initiatorXpub };

  switch (protocol) {
    case ProtocolNames.propose:
      const {
        multisigAddress,
        initiatorXpub,
        responderXpub,
        ...emittedParams
      } = params as ProtocolParams.Propose;
      const json = await store.getStateChannel(multisigAddress);
      if (!json) {
        throw new Error(NO_STATE_CHANNEL_FOR_MULTISIG_ADDR(multisigAddress));
      }
      const app = StateChannel.fromJson(json).mostRecentlyProposedAppInstance();
      return {
        ...baseEvent,
        type: EventNames.PROPOSE_INSTALL_EVENT,
        data: {
          params: {
            ...emittedParams,
            proposedToIdentifier: responderXpub,
          },
          appIdentityHash: app.identityHash,
        },
      };
    case ProtocolNames.install:
      const multisig = (params as ProtocolParams.Install).multisigAddress;
      const retrieved = await store.getStateChannel(multisig);
      if (!retrieved) {
        throw new Error(NO_STATE_CHANNEL_FOR_MULTISIG_ADDR(multisig));
      }
      return {
        ...baseEvent,
        type: EventNames.INSTALL_EVENT,
        data: {
          // TODO: It is weird that `params` is in the event data, we should
          // remove it, but after telling all consumers about this change
          params: {
            appIdentityHash:
              StateChannel
                .fromJson(retrieved)
                .mostRecentlyInstalledAppInstance()
                .identityHash,
          },
        },
      };
    case ProtocolNames.uninstall:
      return {
        ...baseEvent,
        type: EventNames.UNINSTALL_EVENT,
        data: getUninstallEventData(params as ProtocolParams.Uninstall),
      };
    case ProtocolNames.setup:
      return {
        ...baseEvent,
        type: EventNames.CREATE_CHANNEL_EVENT,
        data: getSetupEventData(
          params as ProtocolParams.Setup,
          StateChannel.fromJson(
            (await store.getStateChannel((params as ProtocolParams.Setup).multisigAddress))!,
          ).multisigOwners,
        ),
      };
    case ProtocolNames.takeAction:
    case ProtocolNames.update:
      return {
        ...baseEvent,
        type: EventNames.UPDATE_STATE_EVENT,
        data: getStateUpdateEventData(
          params as ProtocolParams.Update,
          AppInstance.fromJson(
            (await store.getAppInstance(
              (params as ProtocolParams.TakeAction | ProtocolParams.Update).appIdentityHash,
            ))!,
          ).state,
        ),
      };
    default:
      throw new Error(
        `handleReceivedProtocolMessage received invalid protocol message: ${protocol}`,
      );
  }
}

function getStateUpdateEventData(
  params: ProtocolParams.TakeAction | ProtocolParams.Update,
  newState: SolidityValueType,
) {
  // note: action does not exist on type `ProtocolParams.Update`
  // so use any cast
  const { appIdentityHash, action } = params as any;
  return { newState, appIdentityHash, action };
}

function getUninstallEventData({ appIdentityHash }: ProtocolParams.Uninstall) {
  return { appIdentityHash };
}

function getSetupEventData(
  { initiatorXpub: counterpartyXpub, multisigAddress }: ProtocolParams.Setup,
  owners: string[],
) {
  return { multisigAddress, owners, counterpartyXpub };
}
