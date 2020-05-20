import {
  EventNames,
  Message,
  ProtocolMessage,
  ProtocolName,
  ProtocolNames,
  ProtocolParam,
  ProtocolParams,
  SolidityValueType,
  EventPayloads,
  Address,
} from "@connext/types";
import { bigNumberifyJson } from "@connext/utils";

import { UNASSIGNED_SEQ_NO } from "../constants";

import { RequestHandler } from "../request-handler";
import RpcRouter from "../rpc-router";
import { StateChannel } from "../models";

/**
 * Forwards all received Messages that are for the machine's internal
 * protocol execution directly to the protocolRunner's message handler:
 * `runProtocolWithMessage`
 */
export async function handleReceivedProtocolMessage(
  requestHandler: RequestHandler,
  msg: ProtocolMessage,
) {
  const { protocolRunner, store, router } = requestHandler;
  const log = requestHandler.log.newContext("CF-handleReceivedProtocolMessage");

  const { data } = bigNumberifyJson(msg) as ProtocolMessage;

  const { protocol, seq, params } = data;

  if (seq === UNASSIGNED_SEQ_NO) return;

  let postProtocolStateChannel: StateChannel;
  const json = await store.getStateChannelByOwners([
    params!.initiatorIdentifier,
    params!.responderIdentifier,
  ]);
  try {
    const { channel } = await protocolRunner.runProtocolWithMessage(
      data,
      json && StateChannel.fromJson(json),
    );
    postProtocolStateChannel = channel;
  } catch (e) {
    log.error(`Caught error running protocol, aborting. Error: ${e.stack || e.message}`);
    return;
  }

  const outgoingEventData = await getOutgoingEventDataFromProtocol(
    protocol,
    params!,
    postProtocolStateChannel,
  );

  if (!outgoingEventData) {
    return;
  }
  await emitOutgoingMessage(router, outgoingEventData);
}

function emitOutgoingMessage(router: RpcRouter, msg: Message) {
  return router.emit(msg["type"], msg, "outgoing");
}

async function getOutgoingEventDataFromProtocol(
  protocol: ProtocolName,
  params: ProtocolParam,
  postProtocolStateChannel: StateChannel,
): Promise<Message | undefined> {
  // default to the pubId that initiated the protocol
  const baseEvent = { from: params.initiatorIdentifier };

  switch (protocol) {
    case ProtocolNames.propose: {
      const {
        initiatorIdentifier,
        responderIdentifier,
        ...emittedParams
      } = params as ProtocolParams.Propose;
      const app = postProtocolStateChannel.mostRecentlyProposedAppInstance();
      return {
        ...baseEvent,
        type: EventNames.PROPOSE_INSTALL_EVENT,
        data: {
          params: {
            ...emittedParams,
            responderIdentifier,
          },
          appIdentityHash: app.identityHash,
        },
      };
    }
    case ProtocolNames.install: {
      return {
        ...baseEvent,
        type: EventNames.INSTALL_EVENT,
        data: {
          // TODO: It is weird that `params` is in the event data, we should
          // remove it, but after telling all consumers about this change
          params: {
            appIdentityHash: postProtocolStateChannel.getAppInstanceByAppSeqNo(
              (params as ProtocolParams.Install).appSeqNo,
            ).identityHash,
          },
        },
      };
    }
    case ProtocolNames.uninstall: {
      return {
        ...baseEvent,
        type: EventNames.UNINSTALL_EVENT,
        data: getUninstallEventData(params as ProtocolParams.Uninstall),
      };
    }
    case ProtocolNames.setup: {
      return {
        ...baseEvent,
        type: EventNames.CREATE_CHANNEL_EVENT,
        data: {
          ...getSetupEventData(
            params as ProtocolParams.Setup,
            postProtocolStateChannel.multisigOwners,
          ),
        },
      };
    }
    case ProtocolNames.sync: {
      return {
        ...baseEvent,
        type: EventNames.SYNC,
        data: { syncedChannel: postProtocolStateChannel.toJson() },
      };
    }
    case ProtocolNames.takeAction: {
      return {
        ...baseEvent,
        type: EventNames.UPDATE_STATE_EVENT,
        data: getStateUpdateEventData(
          params as ProtocolParams.TakeAction,
          postProtocolStateChannel.getAppInstance(
            (params as ProtocolParams.TakeAction).appIdentityHash,
          ).state,
        ),
      };
    }
    default:
      throw new Error(
        `handleReceivedProtocolMessage received invalid protocol message: ${protocol}`,
      );
  }
}

function getStateUpdateEventData(params: ProtocolParams.TakeAction, newState: SolidityValueType) {
  const { appIdentityHash, action } = params;
  return { newState, appIdentityHash, action };
}

function getUninstallEventData({ appIdentityHash, multisigAddress }: ProtocolParams.Uninstall) {
  return { appIdentityHash, multisigAddress };
}

function getSetupEventData(
  { multisigAddress }: ProtocolParams.Setup,
  owners: Address[],
): Omit<EventPayloads.CreateMultisig, "counterpartyIdentifier"> {
  return { multisigAddress, owners };
}
