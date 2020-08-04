import {
  EventNames,
  ProtocolEventMessage,
  ProtocolMessage,
  ProtocolName,
  ProtocolNames,
  ProtocolParam,
  ProtocolParams,
  SolidityValueType,
  EventPayload,
  Address,
  EventPayloads,
} from "@connext/types";
import { bigNumberifyJson } from "@connext/utils";

import { UNASSIGNED_SEQ_NO } from "../constants";

import { RequestHandler } from "../request-handler";
import { RpcRouter } from "../rpc-router";
import { StateChannel, AppInstance } from "../models";
import { generateProtocolMessageData } from "../protocol/utils";
import { getOutgoingEventFailureDataFromProtocol } from "../machine/protocol-runner";

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

  const msgBn = bigNumberifyJson(msg) as ProtocolMessage;
  const { data } = msgBn;

  const { protocol, seq, params } = data;

  if (seq === UNASSIGNED_SEQ_NO) return;

  let postProtocolStateChannel: StateChannel;
  let appInstance: AppInstance | undefined;
  let protocolMeta: any;
  const json = await store.getStateChannel(params!.multisigAddress);
  try {
    const {
      channel,
      appContext,
      protocolMeta: _protocolMeta,
    } = await protocolRunner.runProtocolWithMessage(
      router,
      msgBn,
      json && StateChannel.fromJson(json),
    );
    postProtocolStateChannel = channel;
    appInstance = appContext || undefined;
    protocolMeta = _protocolMeta;
  } catch (e) {
    log.warn(
      `Caught error running ${protocol} protocol, aborting. Will be retried after syncing. ${
        e.stack || e.message
      }`,
    );
    log.debug(e.stack);
    // NOTE: see comments in IO_SEND_AND_WAIT opcode
    const messageForCounterparty = prepareProtocolErrorMessage(msgBn, e.stack || e.message);
    await requestHandler.messagingService.send(
      messageForCounterparty.data.to,
      messageForCounterparty,
    );
    const outgoingData = getOutgoingEventFailureDataFromProtocol(protocol, params!, e);
    await emitOutgoingMessage(router, outgoingData);
    return;
  }

  const outgoingEventData = getOutgoingEventDataFromProtocol(
    protocol,
    params,
    postProtocolStateChannel,
    appInstance,
    protocolMeta,
  );

  if (!outgoingEventData) {
    return;
  }
  await emitOutgoingMessage(router, outgoingEventData);
}

function emitOutgoingMessage(router: RpcRouter, msg: ProtocolEventMessage<any>) {
  return router.emit(msg["type"], msg, "outgoing");
}

function getOutgoingEventDataFromProtocol(
  protocol: ProtocolName,
  params: ProtocolParam,
  postProtocolStateChannel: StateChannel,
  appContext?: AppInstance,
  protocolMeta?: any,
): ProtocolEventMessage<any> | undefined {
  // default to the pubId that initiated the protocol
  const baseEvent = { from: params.initiatorIdentifier };

  switch (protocol) {
    case ProtocolNames.propose: {
      const app = postProtocolStateChannel.mostRecentlyProposedAppInstance();
      return {
        ...baseEvent,
        type: EventNames.PROPOSE_INSTALL_EVENT,
        data: {
          params,
          appInstanceId: app.identityHash,
          protocolMeta,
        },
      } as ProtocolEventMessage<typeof EventNames.PROPOSE_INSTALL_EVENT>;
    }
    case ProtocolNames.install: {
      return {
        ...baseEvent,
        type: EventNames.INSTALL_EVENT,
        data: {
          appIdentityHash: (params as ProtocolParams.Install).proposal.identityHash,
          appInstance: appContext?.toJson(),
          protocolMeta,
        },
      } as ProtocolEventMessage<typeof EventNames.INSTALL_EVENT>;
    }
    case ProtocolNames.uninstall: {
      if (appContext === undefined || appContext === null) {
        throw new Error("Could not find app context to process event for uninstall protocol");
      }
      return {
        ...baseEvent,
        type: EventNames.UNINSTALL_EVENT,
        data: {
          ...getUninstallEventData(params as ProtocolParams.Uninstall, appContext),
          protocolMeta,
        },
      } as ProtocolEventMessage<typeof EventNames.UNINSTALL_EVENT>;
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
          protocolMeta,
        },
      } as ProtocolEventMessage<typeof EventNames.CREATE_CHANNEL_EVENT>;
    }
    case ProtocolNames.sync: {
      return {
        ...baseEvent,
        type: EventNames.SYNC,
        data: { syncedChannel: postProtocolStateChannel.toJson(), protocolMeta },
      } as ProtocolEventMessage<typeof EventNames.SYNC>;
    }
    case ProtocolNames.takeAction: {
      return {
        ...baseEvent,
        type: EventNames.UPDATE_STATE_EVENT,
        data: {
          ...getStateUpdateEventData(
            params as ProtocolParams.TakeAction,
            postProtocolStateChannel.getAppInstance(
              (params as ProtocolParams.TakeAction).appIdentityHash,
            ).state,
          ),
          protocolMeta,
        },
      } as ProtocolEventMessage<typeof EventNames.UPDATE_STATE_EVENT>;
    }
    default:
      throw new Error(
        `[getOutgoingEventDataFromProtocol] handleReceivedProtocolMessage received invalid protocol message: ${protocol}`,
      );
  }
}

function getStateUpdateEventData(params: ProtocolParams.TakeAction, newState: SolidityValueType) {
  const { appIdentityHash, action } = params;
  return { newState, appIdentityHash, action };
}

function getUninstallEventData(
  params: ProtocolParams.Uninstall,
  appContext: AppInstance,
): EventPayloads.Uninstall {
  const { appIdentityHash, multisigAddress, action } = params;
  return { appIdentityHash, multisigAddress, action, uninstalledApp: appContext.toJson() };
}

function getSetupEventData(
  { multisigAddress }: ProtocolParams.Setup,
  owners: Address[],
): Omit<EventPayload["CREATE_CHANNEL_EVENT"], "counterpartyIdentifier"> {
  return { multisigAddress, owners };
}

const prepareProtocolErrorMessage = (
  latestMsg: ProtocolMessage,
  error: string,
): ProtocolMessage => {
  const {
    data: { protocol, processID, to, params },
    from,
  } = latestMsg;
  return {
    data: generateProtocolMessageData(from, protocol, processID, UNASSIGNED_SEQ_NO, params, {
      error,
    }),
    type: EventNames.PROTOCOL_MESSAGE_EVENT,
    from: to,
  };
};
