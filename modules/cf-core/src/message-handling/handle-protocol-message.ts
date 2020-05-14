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
import { stringify } from "querystring";

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

  let postProtocolStateChannel;
  try {
    const { channel }: { channel: StateChannel } = await protocolRunner.runProtocolWithMessage(
      data,
    );
    postProtocolStateChannel = channel;
  } catch (e) {
    log.error(`Caught error running protocol, aborting. Error: ${stringify(e)}`);
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

  if (protocol !== ProtocolNames.install) {
    await emitOutgoingMessage(router, outgoingEventData);
    return;
  }

  const appIdentityHash =
    outgoingEventData!.data["appIdentityHash"] ||
    (outgoingEventData!.data as any).params["appIdentityHash"];

  if (!appIdentityHash) {
    await emitOutgoingMessage(router, outgoingEventData);
    return;
  }

  const proposal = await store.getAppProposal(appIdentityHash);
  if (!proposal) {
    await emitOutgoingMessage(router, outgoingEventData);
    return;
  }

  // remove proposal from channel and store
  const json = await store.getStateChannelByAppIdentityHash(appIdentityHash);
  if (!json) {
    throw new Error(
      `Could not find channel for app instance ${appIdentityHash} when processing install protocol message`,
    );
  }
  const channel = StateChannel.fromJson(json).removeProposal(proposal.identityHash);
  await store.removeAppProposal(channel.multisigAddress, proposal.identityHash);

  // finally, emit message
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
        multisigAddress,
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
            appIdentityHash: postProtocolStateChannel.mostRecentlyInstalledAppInstance()
              .identityHash,
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

function getUninstallEventData({ appIdentityHash }: ProtocolParams.Uninstall) {
  return { appIdentityHash };
}

function getSetupEventData(
  { multisigAddress }: ProtocolParams.Setup,
  owners: Address[],
): Omit<EventPayloads.CreateMultisig, "counterpartyIdentifier"> {
  return { multisigAddress, owners };
}
