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
import { providers } from "ethers";
import { v4 as uuid } from "uuid";

import { getProtocolFromName } from "../protocol";
import { Context } from "../types";

import { MiddlewareContainer } from "./middleware";

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
    public readonly provider: providers.JsonRpcProvider,
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
  public async runProtocolWithMessage(msg: ProtocolMessageData) {
    const protocol = getProtocolFromName(msg.protocol);
    const step = protocol[msg.seq];
    if (typeof step === "undefined") {
      throw new Error(`Received invalid seq ${msg.seq} for protocol ${msg.protocol}`);
    }
    return this.runProtocol(step, msg);
  }

  public async initiateProtocol(protocolName: ProtocolName, params: ProtocolParam) {
    return this.runProtocol(getProtocolFromName(protocolName)[0], {
      params,
      protocol: protocolName,
      processID: uuid(),
      seq: 0,
      to: params[firstRecipientFromProtocolName(protocolName)],
      customData: {},
    });
  }

  public async runSetupProtocol(params: ProtocolParams.Setup) {
    const protocol = ProtocolNames.setup;
    return this.runProtocol(getProtocolFromName(protocol)[0], {
      protocol,
      params,
      processID: uuid(),
      seq: 0,
      to: params[firstRecipientFromProtocolName(protocol)],
      customData: {},
    });
  }

  private async runProtocol(
    instruction: (context: Context) => AsyncIterableIterator<any>,
    message: ProtocolMessageData,
  ): Promise<void> {
    const context: Context = {
      log: this.log,
      message,
      store: this.store,
      network: this.network,
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
  }
}
