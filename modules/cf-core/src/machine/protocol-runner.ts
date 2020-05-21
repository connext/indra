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
} from "@connext/types";
import { v4 as uuid } from "uuid";

import { getProtocolFromName } from "../protocol";
import { Context } from "../types";

import { MiddlewareContainer } from "./middleware";
import { StateChannel } from "../models";

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
    public readonly store: IStoreService,
    public readonly log: ILoggerService,
  ) {
    this.middlewares = new MiddlewareContainer();
  }

  public register(scope: Opcode, method: GenericMiddleware) {
    this.middlewares.add(scope, method);
  }

  /// Starts executing a protocol in response to a message received. This
  /// function should not be called with messages that are waited for by
  /// `IO_SEND_AND_WAIT`
  public async runProtocolWithMessage(
    msg: ProtocolMessageData,
    preProtocolStateChannel?: StateChannel,
  ) {
    const protocol = getProtocolFromName(msg.protocol);
    const step = protocol[msg.seq];
    if (typeof step === "undefined") {
      throw new Error(`Received invalid seq ${msg.seq} for protocol ${msg.protocol}`);
    }
    return this.runProtocol(step, msg, preProtocolStateChannel);
  }

  public async initiateProtocol(
    protocolName: ProtocolName,
    params: ProtocolParam,
    preProtocolStateChannel?: StateChannel,
  ) {
    return this.runProtocol(
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
  }

  public async runSetupProtocol(params: ProtocolParams.Setup) {
    const protocol = ProtocolNames.setup;
    return this.runProtocol(
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
