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
  const json = await store.getStateChannel(params!.multisigAddress);
  try {
    const { channel, appContext } = await protocolRunner.runProtocolWithMessage(
      router,
      data,
      json && StateChannel.fromJson(json),
    );
    postProtocolStateChannel = channel;
    appInstance = appContext || undefined;
  } catch (e) {
    log.error(`Caught error running ${data.protocol} protocol, aborting. Error: ${e.stack}`);
    // NOTE: see comments in IO_SEND_AND_WAIT opcode
    const messageForCounterparty = prepareProtocolErrorMessage(msgBn, e.message || e);
    await requestHandler.messagingService.send(
      messageForCounterparty.data.to,
      messageForCounterparty,
    );
    return;
  }

  const outgoingEventData = await getOutgoingEventDataFromProtocol(
    protocol,
    params!,
    postProtocolStateChannel,
    appInstance,
  );

  if (!outgoingEventData) {
    return;
  }
  await emitOutgoingMessage(router, outgoingEventData);
}

function emitOutgoingMessage(router: RpcRouter, msg: ProtocolEventMessage<any>) {
  return router.emit(msg["type"], msg, "outgoing");
}

async function getOutgoingEventDataFromProtocol(
  protocol: ProtocolName,
  params: ProtocolParam,
  postProtocolStateChannel: StateChannel,
  appContext?: AppInstance,
): Promise<ProtocolEventMessage<any> | undefined> {
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
        },
      } as ProtocolEventMessage<typeof EventNames.PROPOSE_INSTALL_EVENT>;
    }
    case ProtocolNames.install: {
      return {
        ...baseEvent,
        type: EventNames.INSTALL_EVENT,
        data: {
          appIdentityHash: (params as ProtocolParams.Install).proposal.identityHash,
        },
      } as ProtocolEventMessage<typeof EventNames.INSTALL_EVENT>;
    }
    case ProtocolNames.uninstall: {
      return {
        ...baseEvent,
        type: EventNames.UNINSTALL_EVENT,
        data: getUninstallEventData(params as ProtocolParams.Uninstall, appContext!),
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
        },
      } as ProtocolEventMessage<typeof EventNames.CREATE_CHANNEL_EVENT>;
    }
    case ProtocolNames.sync: {
      return {
        ...baseEvent,
        type: EventNames.SYNC,
        data: { syncedChannel: postProtocolStateChannel.toJson() },
      } as ProtocolEventMessage<typeof EventNames.SYNC>;
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
    data: { protocol, processID, to },
    from,
  } = latestMsg;
  return {
    data: {
      protocol,
      processID,
      seq: UNASSIGNED_SEQ_NO,
      to: from,
      error,
      customData: {},
    },
    type: EventNames.PROTOCOL_MESSAGE_EVENT,
    from: to,
  };
};
