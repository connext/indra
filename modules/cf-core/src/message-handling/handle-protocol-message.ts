import {
  bigNumberifyJson,
  EventNames,
  ProtocolName,
  ProtocolNames,
  ProtocolParam,
  ProtocolParams,
} from "@connext/types";

import { UNASSIGNED_SEQ_NO } from "../constants";
import { NO_PROPOSED_APP_INSTANCE_FOR_APP_INSTANCE_ID } from "../errors";

import { RequestHandler } from "../request-handler";
import RpcRouter from "../rpc-router";
import {
  EventEmittedMessage,
  NetworkContext,
  NodeMessageWrappedProtocolMessage,
  SolidityValueType,
} from "../types";
import { Store } from "../store";

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

  if (outgoingEventData && protocol === ProtocolNames.install) {
    const appInstanceId =
      outgoingEventData!.data["appInstanceId"] ||
      (outgoingEventData!.data as any).params["appInstanceId"];
    if (appInstanceId) {
      let proposal;
      try {
        proposal = await store.getAppInstanceProposal(appInstanceId);
      } catch (e) {
        if (!e.toString().includes(NO_PROPOSED_APP_INSTANCE_FOR_APP_INSTANCE_ID(appInstanceId))) {
          throw e;
        }
      }
      if (proposal) {
        const channel = (
          await store.getStateChannelFromAppInstanceID(appInstanceId)
        ).removeProposal(proposal.identityHash);
        await store.removeAppProposal(channel, proposal);
      }
    }
  }

  if (outgoingEventData) {
    await emitOutgoingNodeMessage(router, outgoingEventData);
  }
}

function emitOutgoingNodeMessage(router: RpcRouter, msg: EventEmittedMessage) {
  return router.emit(msg["type"], msg, "outgoing");
}

async function getOutgoingEventDataFromProtocol(
  protocol: ProtocolName,
  params: ProtocolParam,
  networkContext: NetworkContext,
  store: Store,
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
      return {
        ...baseEvent,
        type: EventNames.PROPOSE_INSTALL_EVENT,
        data: {
          params: {
            ...emittedParams,
            proposedToIdentifier: responderXpub,
          },
          appInstanceId: (
            await store.getStateChannel(multisigAddress)
          ).mostRecentlyProposedAppInstance().identityHash,
        },
      };
    case ProtocolNames.install:
      return {
        ...baseEvent,
        type: EventNames.INSTALL_EVENT,
        data: {
          // TODO: It is weird that `params` is in the event data, we should
          // remove it, but after telling all consumers about this change
          params: {
            appInstanceId: (
              await store.getStateChannel((params as ProtocolParams.Install).multisigAddress)
            ).mostRecentlyInstalledAppInstance().identityHash,
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
          (await store.getStateChannel((params as ProtocolParams.Setup).multisigAddress))!
            .multisigOwners,
        ),
      };
    case ProtocolNames.takeAction:
    case ProtocolNames.update:
      return {
        ...baseEvent,
        type: EventNames.UPDATE_STATE_EVENT,
        data: getStateUpdateEventData(
          params as ProtocolParams.Update,
          (
            await store.getAppInstance(
              (params as ProtocolParams.TakeAction | ProtocolParams.Update).appIdentityHash,
            )
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
  const { appIdentityHash: appInstanceId, action } = params as any;
  return { newState, appInstanceId, action };
}

function getUninstallEventData({ appIdentityHash: appInstanceId }: ProtocolParams.Uninstall) {
  return { appInstanceId };
}

function getSetupEventData(
  { initiatorXpub: counterpartyXpub, multisigAddress }: ProtocolParams.Setup,
  owners: string[],
) {
  return { multisigAddress, owners, counterpartyXpub };
}
