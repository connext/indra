import {
  ILoggerService,
  ProtocolName,
  ProtocolNames,
  ProtocolParam,
  ProtocolParams,
} from "@connext/types";
import { BaseProvider } from "ethers/providers";
import { v4 as uuid } from "uuid";

import { getProtocolFromName } from "../protocol";
import {
  Context,
<<<<<<< HEAD
=======
  InstallProtocolParams,
>>>>>>> 845-store-refactor
  Middleware,
  NetworkContext,
  Opcode,
  ProtocolMessage,
<<<<<<< HEAD
=======
  SetupProtocolParams,
  TakeActionProtocolParams,
  UninstallProtocolParams,
  UpdateProtocolParams,
>>>>>>> 845-store-refactor
} from "../types";

import { MiddlewareContainer } from "./middleware";
import { Store } from "../store";

<<<<<<< HEAD
function firstRecipientFromProtocolName(protocolName: ProtocolName) {
  if (Object.values(ProtocolNames).includes(protocolName)) {
=======
/**
Type-level mapping from Protocol to Protocol Param
For e.g., ParamTypeOf<Protocol.Install> = InstallProtocolParams
This syntax is preferred according to:
https://www.typescriptlang.org/docs/handbook/release-notes/typescript-2-8.html#conditional-types
**/
type ParamTypeOf<T extends Protocol> = T extends Protocol.Install
  ? InstallProtocolParams
  : T extends Protocol.Update
  ? UpdateProtocolParams
  : T extends Protocol.Uninstall
  ? UninstallProtocolParams
  : T extends Protocol.TakeAction
  ? TakeActionProtocolParams
  : T extends Protocol.Propose
  ? ProposeInstallProtocolParams
  : never;

function firstRecipientFromProtocolName(protocolName: Protocol) {
  if (
    [
      Protocol.Update,
      Protocol.Uninstall,
      Protocol.TakeAction,
      Protocol.Install,
      Protocol.Propose,
    ].indexOf(protocolName) !== -1
  ) {
>>>>>>> 845-store-refactor
    return "responderXpub";
  }
  throw Error(`Unknown protocolName ${protocolName} passed to firstRecipientFromProtocolName`);
}

export class ProtocolRunner {
  public middlewares: MiddlewareContainer;

  constructor(
    public readonly network: NetworkContext,
    public readonly provider: BaseProvider,
    public readonly store: Store,
    public readonly log: ILoggerService,
  ) {
    this.network.provider = network.provider || provider;
    this.middlewares = new MiddlewareContainer();
  }

  public register(scope: Opcode, method: Middleware) {
    this.middlewares.add(scope, method);
  }

  /// Starts executing a protocol in response to a message received. This
  /// function should not be called with messages that are waited for by
  /// `IO_SEND_AND_WAIT`
  public async runProtocolWithMessage(msg: ProtocolMessage) {
    const protocol = getProtocolFromName(msg.protocol);
    const step = protocol[msg.seq];
    if (step === undefined) {
      throw Error(`Received invalid seq ${msg.seq} for protocol ${msg.protocol}`);
    }
    return this.runProtocol(step, msg);
  }

  public async initiateProtocol(protocolName: ProtocolName, params: ProtocolParam) {
    return this.runProtocol(getProtocolFromName(protocolName)[0], {
      params,
      protocol: protocolName,
      processID: uuid(),
      seq: 0,
      toXpub: params[firstRecipientFromProtocolName(protocolName)],
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
      toXpub: params.responderXpub,
      customData: {},
    });
  }

  private async runProtocol(
    instruction: (context: Context) => AsyncIterableIterator<any>,
    message: ProtocolMessage,
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
