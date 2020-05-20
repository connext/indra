import {
  GenericMiddleware,
  ILoggerService,
  IStoreService,
  NetworkContext,
  Opcode,
  ProtocolMessageData,
  ProtocolName,
  ProtocolNames,
  ProtocolParam,
  ProtocolParams,
  EventNames,
  Message,
} from "@connext/types";
import { JsonRpcProvider } from "ethers/providers";
import { v4 as uuid } from "uuid";

import { getProtocolFromName } from "../protocol";
import { Context } from "../types";

import { MiddlewareContainer } from "./middleware";
import { StateChannel } from "../models";
import RpcRouter from "../rpc-router";

function firstRecipientFromProtocolName(protocolName: ProtocolName) {
  if (Object.values(ProtocolNames).includes(protocolName)) {
    return "responderIdentifier";
  }
  throw new Error(`Unknown protocolName ${protocolName} passed to firstRecipientFromProtocolName`);
}

export class ProtocolRunner {
  public middlewares: MiddlewareContainer;

  constructor(
    public readonly network: NetworkContext,
    public readonly provider: JsonRpcProvider,
    public readonly store: IStoreService,
    public readonly log: ILoggerService,
  ) {
    this.network.provider = network.provider || provider;
    this.middlewares = new MiddlewareContainer();
  }

  public register(scope: Opcode, method: GenericMiddleware) {
    this.middlewares.add(scope, method);
  }

  /// Starts executing a protocol in response to a message received. This
  /// function should not be called with messages that are waited for by
  /// `IO_SEND_AND_WAIT`
  public async runProtocolWithMessage(
    router: RpcRouter,
    msg: ProtocolMessageData,
    preProtocolStateChannel?: StateChannel,
  ) {
    const protocol = getProtocolFromName(msg.protocol);
    const step = protocol[msg.seq];
    if (typeof step === "undefined") {
      throw new Error(`Received invalid seq ${msg.seq} for protocol ${msg.protocol}`);
    }
    try {
      const protocolRet = await this.runProtocol(step, msg, preProtocolStateChannel);
      return protocolRet;
    } catch (error) {
      const { protocol, params } = msg;
      const outgoingData = getOutgoingEventFailureDataFromProtocol(protocol, params!, error);
      await emitOutgoingMessage(router, outgoingData);
      throw error;
    }
  }

  public async initiateProtocol(
    router: RpcRouter,
    protocolName: ProtocolName,
    params: ProtocolParam,
    preProtocolStateChannel?: StateChannel,
  ) {
    try {
      const protocolRet = this.runProtocol(
        getProtocolFromName(protocolName)[0],
        {
          params,
          protocol: protocolName,
          processID: uuid(),
          seq: 0,
          to: params[firstRecipientFromProtocolName(protocolName)],
          customData: {},
        },
        preProtocolStateChannel,
      );
      return protocolRet;
    } catch (error) {
      const outgoingData = getOutgoingEventFailureDataFromProtocol(protocolName, params, error);
      await emitOutgoingMessage(router, outgoingData);
      throw error;
    }
  }

  public async runSetupProtocol(router: RpcRouter, params: ProtocolParams.Setup) {
    const protocol = ProtocolNames.setup;
    try {
      const protocolRet = await this.runProtocol(
        getProtocolFromName(protocol)[0],
        {
          protocol,
          params,
          processID: uuid(),
          seq: 0,
          to: params[firstRecipientFromProtocolName(protocol)],
          customData: {},
        },
        {} as any,
      );
      return protocolRet;
    } catch (error) {
      const outgoingData = getOutgoingEventFailureDataFromProtocol(protocol, params, error);
      await emitOutgoingMessage(router, outgoingData);
      throw error;
    }
  }

  private async runProtocol(
    instruction: (context: Context) => AsyncIterableIterator<any>,
    message: ProtocolMessageData,
    preProtocolStateChannel?: StateChannel,
  ): Promise<{ channel: StateChannel; data: any }> {
    const context: Context = {
      log: this.log,
      message,
      store: this.store,
      network: this.network,
      preProtocolStateChannel,
    };

    let lastMiddlewareRet: any = undefined;
    const process = instruction(context);
    while (true) {
      const ret = await process.next(lastMiddlewareRet);
      if (ret.done) {
        break;
      }
      const [opcode, ...args] = ret.value;
      lastMiddlewareRet = await this.middlewares.run(opcode, args);
    }
    return lastMiddlewareRet;
  }
}

function getOutgoingEventFailureDataFromProtocol(
  protocol: ProtocolName,
  params: ProtocolParam,
  error: Error,
): Message {
  const baseEvent = {
    from: params.initiatorIdentifier,
    data: {
      params,
      error: error.stack || error.message,
    },
  };
  switch (protocol) {
    case ProtocolNames.setup: {
      return {
        ...baseEvent,
        type: EventNames.SETUP_FAILED_EVENT,
      };
    }
    case ProtocolNames.sync: {
      return {
        ...baseEvent,
        type: EventNames.SYNC_FAILED_EVENT,
      };
    }
    case ProtocolNames.propose: {
      return {
        ...baseEvent,
        type: EventNames.PROPOSE_INSTALL_FAILED_EVENT,
      };
    }
    case ProtocolNames.install: {
      return {
        ...baseEvent,
        type: EventNames.INSTALL_FAILED_EVENT,
      };
    }
    case ProtocolNames.takeAction: {
      return {
        ...baseEvent,
        type: EventNames.UPDATE_STATE_FAILED_EVENT,
      };
    }
    case ProtocolNames.uninstall: {
      return {
        ...baseEvent,
        type: EventNames.UNINSTALL_FAILED_EVENT,
      };
    }
    default: {
      const unexpected: never = protocol;
      throw new Error(`[getOutgoingEventFailureDataFromProtocol] Unexpected case: ${unexpected}`);
    }
  }
}

function emitOutgoingMessage(router: RpcRouter, msg: Message) {
  return router.emit(msg["type"], msg, "outgoing");
}
