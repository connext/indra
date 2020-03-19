import {
  PROPOSE_INSTALL_EVENT,
  INSTALL_EVENT,
  UNINSTALL_EVENT,
  CREATE_CHANNEL_EVENT,
  UPDATE_STATE_EVENT,
  INSTALL_VIRTUAL_EVENT,
  UNINSTALL_VIRTUAL_EVENT,
} from "@connext/types";

import { Protocol } from "../machine";
import { NO_PROPOSED_APP_INSTANCE_FOR_APP_INSTANCE_ID } from "../methods";
import { StateChannel } from "../models";
import { UNASSIGNED_SEQ_NO } from "../protocol";
import { RequestHandler } from "../request-handler";
import RpcRouter from "../rpc-router";
import {
  EventEmittedMessage,
  InstallProtocolParams,
  InstallVirtualAppProtocolParams,
  NetworkContext,
  NodeMessageWrappedProtocolMessage,
  ProposeInstallProtocolParams,
  ProtocolParameters,
  SetupProtocolParams,
  SolidityValueType,
  TakeActionProtocolParams,
  UninstallProtocolParams,
  UninstallVirtualAppProtocolParams,
  UpdateProtocolParams,
} from "../types";
import { bigNumberifyJson } from "../utils";
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

  const preProtocolStateChannelsMap = await store.getStateChannelsMap();

  const postProtocolStateChannelsMap = await protocolRunner.runProtocolWithMessage(
    data,
    preProtocolStateChannelsMap,
  );

  const outgoingEventData = await getOutgoingEventDataFromProtocol(
    protocol,
    params!,
    postProtocolStateChannelsMap,
    networkContext,
    store,
    publicIdentifier,
  );

  if (
    outgoingEventData &&
    (protocol === Protocol.Install || protocol === Protocol.InstallVirtualApp)
  ) {
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
        await store.saveStateChannel(
          (await store.getChannelFromAppInstanceID(appInstanceId)).removeProposal(appInstanceId),
        );
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
  protocol: Protocol,
  params: ProtocolParameters,
  stateChannelsMap: Map<string, StateChannel>,
  networkContext: NetworkContext,
  store: Store,
  publicIdentifier: string,
): Promise<EventEmittedMessage | undefined> {
  // default to the pubId that initiated the protocol
  const baseEvent = { from: params.initiatorXpub };

  switch (protocol) {
    case Protocol.Propose:
      const {
        multisigAddress,
        initiatorXpub,
        responderXpub,
        ...emittedParams
      } = params as ProposeInstallProtocolParams;
      return {
        ...baseEvent,
        type: PROPOSE_INSTALL_EVENT,
        data: {
          params: {
            ...emittedParams,
            proposedToIdentifier: responderXpub,
          },
          appInstanceId: stateChannelsMap
            .get((params as ProposeInstallProtocolParams).multisigAddress)!
            .mostRecentlyProposedAppInstance().identityHash,
        },
      };
    case Protocol.Install:
      return {
        ...baseEvent,
        type: INSTALL_EVENT,
        data: {
          // TODO: It is weird that `params` is in the event data, we should
          // remove it, but after telling all consumers about this change
          params: {
            appInstanceId: stateChannelsMap
              .get((params as InstallProtocolParams).multisigAddress)!
              .mostRecentlyInstalledAppInstance().identityHash,
          },
        },
      };
    case Protocol.Uninstall:
      return {
        ...baseEvent,
        type: UNINSTALL_EVENT,
        data: getUninstallEventData(params as UninstallProtocolParams),
      };
    case Protocol.Setup:
      return {
        ...baseEvent,
        type: CREATE_CHANNEL_EVENT,
        data: getSetupEventData(
          params as SetupProtocolParams,
          stateChannelsMap.get((params as SetupProtocolParams).multisigAddress)!.multisigOwners,
        ),
      };
    case Protocol.TakeAction:
    case Protocol.Update:
      return {
        ...baseEvent,
        type: UPDATE_STATE_EVENT,
        data: getStateUpdateEventData(
          params as UpdateProtocolParams,
          stateChannelsMap
            .get((params as TakeActionProtocolParams | UpdateProtocolParams).multisigAddress)!
            .getAppInstance(
              (params as TakeActionProtocolParams | UpdateProtocolParams).appIdentityHash,
            )!.state,
        ),
      };
    case Protocol.InstallVirtualApp:
      const {
        initiatorXpub: initiator,
        intermediaryXpub,
        responderXpub: responder,
      } = params as InstallVirtualAppProtocolParams;
      // channels for responders and initiators of virtual protocols are
      // persisted at the end of the `propose` protocol. channels with the
      // intermediary should *already exist*
      // HOWEVER -- if this *is* the intermediary, it will not have any
      // channels between the responder and the initiator in its store
      // since it is not involved in the `propose` protocol. in this case,
      // you should allow the generation of the multisig in the store. Note that
      // the intermediary will very likely *not* have this in their store, so
      // there will not be any outgoing data for the protocol, so no install
      // virtual event will be emitted on the node
      const isIntermediary = publicIdentifier === intermediaryXpub;

      const virtualChannel = await store.getMultisigAddressWithCounterparty(
        [responder, initiator],
        networkContext.ProxyFactory,
        networkContext.MinimumViableMultisig,
        isIntermediary ? networkContext.provider : undefined,
      );
      if (stateChannelsMap.has(virtualChannel)) {
        return {
          ...baseEvent,
          type: INSTALL_VIRTUAL_EVENT,
          data: {
            // TODO: It is weird that `params` is in the event data, we should
            // remove it, but after telling all consumers about this change
            params: {
              appInstanceId: stateChannelsMap
                .get(virtualChannel)!
                .mostRecentlyInstalledAppInstance().identityHash,
            },
          },
        };
      }
      return;
    case Protocol.UninstallVirtualApp:
      return {
        ...baseEvent,
        type: UNINSTALL_VIRTUAL_EVENT,
        data: getUninstallVirtualAppEventData(params as UninstallVirtualAppProtocolParams),
      };
    default:
      throw Error(`handleReceivedProtocolMessage received invalid protocol message: ${protocol}`);
  }
}

function getStateUpdateEventData(
  params: TakeActionProtocolParams | UpdateProtocolParams,
  newState: SolidityValueType,
) {
  // note: action does not exist on type `UpdateProtocolParams`
  // so use any cast
  const { appIdentityHash: appInstanceId, action } = params as any;
  return { newState, appInstanceId, action };
}

function getUninstallVirtualAppEventData({
  intermediaryXpub: intermediaryIdentifier,
  targetAppIdentityHash: appInstanceId,
}: UninstallVirtualAppProtocolParams) {
  return { appInstanceId, intermediaryIdentifier };
}

function getUninstallEventData({ appIdentityHash: appInstanceId }: UninstallProtocolParams) {
  return { appInstanceId };
}

function getSetupEventData(
  { initiatorXpub: counterpartyXpub, multisigAddress }: SetupProtocolParams,
  owners: string[],
) {
  return { multisigAddress, owners, counterpartyXpub };
}

