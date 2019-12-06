import {
  InstallProtocolParams,
  InstallVirtualAppProtocolParams,
  Protocol,
  SetupProtocolParams,
  TakeActionProtocolParams,
  UninstallProtocolParams,
  UninstallVirtualAppProtocolParams,
  UpdateProtocolParams,
  WithdrawProtocolParams,
} from "../machine";
import { ProposeInstallProtocolParams, ProtocolParameters } from "../machine/types";
import { NO_PROPOSED_APP_INSTANCE_FOR_APP_INSTANCE_ID } from "../methods/errors";
import { StateChannel } from "../models";
import { UNASSIGNED_SEQ_NO } from "../protocol/utils/signature-forwarder";
import { RequestHandler } from "../request-handler";
import RpcRouter from "../rpc-router";
import {
  EventEmittedMessage,
  NetworkContext,
  Node,
  NODE_EVENTS,
  NodeMessageWrappedProtocolMessage,
  SolidityValueType,
  WithdrawStartedMessage,
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
  msg: NodeMessageWrappedProtocolMessage
) {
  const {
    protocolRunner,
    store,
    router,
    networkContext
  } = requestHandler;

  const { data } = bigNumberifyJson(msg) as NodeMessageWrappedProtocolMessage;

  const { protocol, seq, params } = data;

  if (seq === UNASSIGNED_SEQ_NO) return;

  const preProtocolStateChannelsMap = await store.getStateChannelsMap();

  const postProtocolStateChannelsMap = await protocolRunner.runProtocolWithMessage(
    data,
    preProtocolStateChannelsMap
  );

  const outgoingEventData = await getOutgoingEventDataFromProtocol(
    protocol,
    params!,
    postProtocolStateChannelsMap,
    networkContext,
    store,
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
        if (
          !e
            .toString()
            .includes(
              NO_PROPOSED_APP_INSTANCE_FOR_APP_INSTANCE_ID(appInstanceId)
            )
        ) {
          throw e;
        }
      }
      if (proposal) {
        await store.saveStateChannel(
          (await store.getChannelFromAppInstanceID(
            appInstanceId
          )).removeProposal(appInstanceId)
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
): Promise<EventEmittedMessage | undefined> {
  // default to the pubId that initiated the protocol
  const baseEvent = { from: params.initiatorXpub };

  switch (protocol) {
    case Protocol.Propose:
      const { multisigAddress, initiatorXpub, responderXpub, ...emittedParams} = params as ProposeInstallProtocolParams;
      return {
        ...baseEvent,
        type: NODE_EVENTS.PROPOSE_INSTALL,
        data: {
          params: {
            ...emittedParams,
            proposedToIdentifier: responderXpub,
          },
          appInstanceId: stateChannelsMap
            .get((params as ProposeInstallProtocolParams).multisigAddress)!
            .mostRecentlyProposedAppInstance().identityHash
        }
      };
    case Protocol.Install:
      return {
        ...baseEvent,
        type: NODE_EVENTS.INSTALL,
        data: {
          // TODO: It is weird that `params` is in the event data, we should
          // remove it, but after telling all consumers about this change
          params: {
            appInstanceId: stateChannelsMap
              .get((params as InstallProtocolParams).multisigAddress)!
              .mostRecentlyInstalledAppInstance().identityHash
          }
        }
      };
    case Protocol.Uninstall:
      return {
        ...baseEvent,
        type: NODE_EVENTS.UNINSTALL,
        data: getUninstallEventData(params as UninstallProtocolParams)
      };
    case Protocol.Setup:
      return {
        ...baseEvent,
        type: NODE_EVENTS.CREATE_CHANNEL,
        data: getSetupEventData(
          params as SetupProtocolParams,
          stateChannelsMap.get((params as SetupProtocolParams).multisigAddress)!
            .multisigOwners
        )
      };
    case Protocol.Withdraw:
      // NOTE: responder will only ever emit a withdraw started
      // event. does not include tx hash
      // determine if the withdraw is finishing or if it is starting
      return {
        ...baseEvent,
        type: NODE_EVENTS.WITHDRAWAL_STARTED,
        data: getWithdrawEventData(params as WithdrawProtocolParams)
      } as WithdrawStartedMessage;
    case Protocol.TakeAction:
    case Protocol.Update:
      return {
        ...baseEvent,
        type: NODE_EVENTS.UPDATE_STATE,
        data: getStateUpdateEventData(
          params as UpdateProtocolParams,
          stateChannelsMap
            .get((params as TakeActionProtocolParams | UpdateProtocolParams).multisigAddress)!
            .getAppInstance(
              (params as TakeActionProtocolParams | UpdateProtocolParams).appIdentityHash
            )!.state
        )
      };
    case Protocol.InstallVirtualApp:
      const virtualChannel = await store.getMultisigAddressWithCounterparty(
        [params.responderXpub, params.initiatorXpub],
        networkContext.ProxyFactory,
        networkContext.MinimumViableMultisig,
        networkContext.provider
      );
      if (stateChannelsMap.has(virtualChannel)) {
        return {
          ...baseEvent,
          type: NODE_EVENTS.INSTALL_VIRTUAL,
          data: {
            // TODO: It is weird that `params` is in the event data, we should
            // remove it, but after telling all consumers about this change
            params: {
              appInstanceId: stateChannelsMap
                .get(virtualChannel)!
                .mostRecentlyInstalledAppInstance().identityHash
            }
          }
        };
      }
      return;
    case Protocol.UninstallVirtualApp:
      return {
        ...baseEvent,
        type: NODE_EVENTS.UNINSTALL_VIRTUAL,
        data: getUninstallVirtualAppEventData(
          params as UninstallVirtualAppProtocolParams
        )
      };
    default:
      throw Error(
        `handleReceivedProtocolMessage received invalid protocol message: ${protocol}`
      );
  }
}

function getStateUpdateEventData(
  params: TakeActionProtocolParams | UpdateProtocolParams,
  newState: SolidityValueType
) {
  // note: action does not exist on type `UpdateProtocolParams`
  // so use any cast
  const { appIdentityHash: appInstanceId, action } = params as any;
  return { newState, appInstanceId, action };
}

function getUninstallVirtualAppEventData({
  intermediaryXpub: intermediaryIdentifier,
  targetAppIdentityHash: appInstanceId
}: UninstallVirtualAppProtocolParams) {
  return { appInstanceId, intermediaryIdentifier };
}

function getUninstallEventData({
  appIdentityHash: appInstanceId
}: UninstallProtocolParams) {
  return { appInstanceId };
}

function getWithdrawEventData(params: WithdrawProtocolParams) {
  const { multisigAddress, tokenAddress, recipient, amount } = params;
  return {
    params: {
      multisigAddress,
      tokenAddress,
      recipient,
      amount
    },
  };
}

function getSetupEventData(
  { initiatorXpub: counterpartyXpub, multisigAddress }: SetupProtocolParams,
  owners: string[]
) {
  return { multisigAddress, owners, counterpartyXpub };
}

/**
 * Produces an array of queues that the client must halt execution on
 * for some particular protocol and its set of parameters/
 *
 * @param {string} protocol - string name of the protocol
 * @param {ProtocolParameters} params - parameters relevant for the protocol
 * @param {Store} store - the store the client is connected to
 * @param {RequestHandler} requestHandler - the request handler object of the client
 *
 * @returns {Promise<string[]>} - list of the names of the queues
 */
async function getQueueNamesListByProtocolName(
  protocol: string,
  params: ProtocolParameters,
  requestHandler: RequestHandler
): Promise<string[]> {
  const {
    networkContext,
    provider,
    publicIdentifier,
    store
  } = requestHandler;

  async function multisigAddressFor(xpubs: string[]) {
    const allowGenerated = protocol === Protocol.Setup || protocol === Protocol.InstallVirtualApp;
    return await store.getMultisigAddressWithCounterparty(
      xpubs,
      networkContext.ProxyFactory,
      networkContext.MinimumViableMultisig,
      allowGenerated ? provider : undefined
    );
  }

  switch (protocol) {
    /**
     * Queue on the multisig address of the direct channel.
     */
    case Protocol.Install:
    case Protocol.Setup:
    case Protocol.Withdraw:
    case Protocol.Propose:
      const { multisigAddress } = params as
        | InstallProtocolParams
        | SetupProtocolParams
        | WithdrawProtocolParams;

      return [multisigAddress];

    /**
     * Queue on the appInstanceId of the AppInstance.
     */
    case Protocol.TakeAction:
    case Protocol.Update:
      const { appIdentityHash } = params as TakeActionProtocolParams | UpdateProtocolParams;

      return [appIdentityHash];

    case Protocol.Uninstall:
      const {
        multisigAddress: addr,
        appIdentityHash: appInstanceId
      } = params as UninstallProtocolParams;

      return [addr, appInstanceId];

    /**
     * Queue on the multisig addresses of both direct channels involved.
     */
    case Protocol.InstallVirtualApp:
      const {
        initiatorXpub,
        intermediaryXpub,
        responderXpub
      } = params as InstallVirtualAppProtocolParams;

      if (publicIdentifier === intermediaryXpub) {
        return [
          await multisigAddressFor([initiatorXpub, intermediaryXpub]),
          await multisigAddressFor([responderXpub, intermediaryXpub])
        ];
      }

      if (publicIdentifier === responderXpub) {
        return [
          await multisigAddressFor([responderXpub, intermediaryXpub]),
          await multisigAddressFor([responderXpub, initiatorXpub])
        ];
      }

    /**
     * Queue on the multisig addresses of both direct channels involved,
     * as well as on the app itself
     */
    case Protocol.UninstallVirtualApp:
      const {
        initiatorXpub: initiator,
        intermediaryXpub: intermediary,
        responderXpub: responder,
        targetAppIdentityHash
      } = params as UninstallVirtualAppProtocolParams;

      if (publicIdentifier === intermediary) {
        return [
          await multisigAddressFor([initiator, intermediary]),
          await multisigAddressFor([responder, intermediary]),
          targetAppIdentityHash
        ];
      }

      if (publicIdentifier === responder) {
        return [
          await multisigAddressFor([responder, intermediary]),
          await multisigAddressFor([responder, initiator]),
          targetAppIdentityHash
        ];
      }

    // NOTE: This file is only reachable if a protocol message is sent
    // from an initiator to an intermediary, an intermediary to
    // a responder, or an initiator to a responder. It is never possible
    // for the publicIdentifier to be the initiatorXpub, so we ignore
    // that case.

    default:
      throw Error(
        `handleReceivedProtocolMessage received invalid protocol message: ${protocol}`
      );
  }
}
