import {
  PROPOSE_INSTALL_EVENT,
  INSTALL_EVENT,
  UNINSTALL_EVENT,
  CREATE_CHANNEL_EVENT,
  WITHDRAWAL_STARTED_EVENT,
  UPDATE_STATE_EVENT,
} from "@connext/types";
import { Protocol } from "../machine";
import { NO_PROPOSED_APP_INSTANCE_FOR_APP_INSTANCE_ID } from "../methods/errors";
import { UNASSIGNED_SEQ_NO } from "../protocol/utils/signature-forwarder";

import { RequestHandler } from "../request-handler";
import RpcRouter from "../rpc-router";
import {
  EventEmittedMessage,
  InstallProtocolParams,
  NetworkContext,
  NodeMessageWrappedProtocolMessage,
  ProposeInstallProtocolParams,
  ProtocolParameters,
  SetupProtocolParams,
  SolidityValueType,
  TakeActionProtocolParams,
  UninstallProtocolParams,
  UpdateProtocolParams,
  WithdrawProtocolParams,
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

  if (outgoingEventData && protocol === Protocol.Install) {
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
  protocol: Protocol,
  params: ProtocolParameters,
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
          appInstanceId: (
            await store.getStateChannel(multisigAddress)
          ).mostRecentlyProposedAppInstance().identityHash,
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
            appInstanceId: (
              await store.getStateChannel((params as InstallProtocolParams).multisigAddress)
            ).mostRecentlyInstalledAppInstance().identityHash,
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
          (await store.getStateChannel((params as SetupProtocolParams).multisigAddress))!
            .multisigOwners,
        ),
      };
    case Protocol.Withdraw:
      // NOTE: responder will only ever emit a withdraw started
      // event. does not include tx hash
      // determine if the withdraw is finishing or if it is starting
      return {
        ...baseEvent,
        type: WITHDRAWAL_STARTED_EVENT,
        data: getWithdrawEventData(params as WithdrawProtocolParams),
      } as WithdrawStartedMessage;
    case Protocol.TakeAction:
    case Protocol.Update:
      return {
        ...baseEvent,
        type: UPDATE_STATE_EVENT,
        data: getStateUpdateEventData(
          params as UpdateProtocolParams,
          (
            await store.getAppInstance(
              (params as TakeActionProtocolParams | UpdateProtocolParams).appIdentityHash,
            )
          ).state,
        ),
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

function getUninstallEventData({ appIdentityHash: appInstanceId }: UninstallProtocolParams) {
  return { appInstanceId };
}

function getWithdrawEventData(params: WithdrawProtocolParams) {
  const { multisigAddress, tokenAddress, recipient, amount } = params;
  return {
    params: {
      multisigAddress,
      tokenAddress,
      recipient,
      amount,
    },
  };
}

function getSetupEventData(
  { initiatorXpub: counterpartyXpub, multisigAddress }: SetupProtocolParams,
  owners: string[],
) {
  return { multisigAddress, owners, counterpartyXpub };
}
