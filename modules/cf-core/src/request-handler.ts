import {
  EventNames,
  IChannelSigner,
  ILoggerService,
  IMessagingService,
  IStoreService,
  Message,
  MethodName,
  NetworkContext,
  ProtocolMessage,
  PublicIdentifier,
  ILockService,
} from "@connext/types";
import { bigNumberifyJson, logTime } from "@connext/utils";
import EventEmitter from "eventemitter3";

import { eventNameToImplementation, methodNameToImplementation } from "./methods";
import { ProtocolRunner } from "./machine";
import RpcRouter from "./rpc-router";
import { MethodRequest, MethodResponse } from "./types";
/**
 * This class registers handlers for requests to get or set some information
 * about app instances and channels for this Node and any relevant peer Nodes.
 */
export class RequestHandler {
  private readonly methods = new Map();
  private readonly events = new Map();

  router!: RpcRouter;

  constructor(
    readonly publicIdentifier: PublicIdentifier,
    readonly incoming: EventEmitter,
    readonly outgoing: EventEmitter,
    readonly store: IStoreService,
    readonly messagingService: IMessagingService,
    readonly protocolRunner: ProtocolRunner,
    readonly networkContext: NetworkContext,
    readonly signer: IChannelSigner,
    readonly blocksNeededForConfirmation: number,
    readonly lockService: ILockService,
    public readonly log: ILoggerService,
  ) {
    this.log = this.log.newContext("CF-RequestHandler");
  }

  injectRouter(router: RpcRouter) {
    this.router = router;
    this.mapPublicApiMethods();
    this.mapEventHandlers();
  }

  /**
   * In some use cases, waiting for the response of a method call is easier
   * and cleaner than wrangling through callback hell.
   * @param method
   * @param req
   */
  public async callMethod(method: MethodName, req: MethodRequest): Promise<MethodResponse> {
    const start = Date.now();
    const result: MethodResponse = {
      type: req.type,
      requestId: req.requestId,
      result: await this.methods.get(method)(this, req.params),
    };
    logTime(this.log, start, `Method ${method} was executed`);
    return result;
  }

  /**
   * This registers all of the methods the Node is expected to have
   */
  private mapPublicApiMethods() {
    for (const methodName in methodNameToImplementation) {
      this.methods.set(methodName, methodNameToImplementation[methodName]);
      this.incoming.on(methodName, async (req: MethodRequest) => {
        const res: MethodResponse = {
          type: req.type,
          requestId: req.requestId,
          result: await this.methods.get(methodName)(this, bigNumberifyJson(req.params)),
        };
        this.router.emit((req as any).methodName, res, "outgoing");
      });
    }
  }

  /**
   * This maps the Node event names to their respective handlers.
   * These are the events being listened on to detect requests from peer Nodes.
   */
  private mapEventHandlers() {
    for (const eventName of Object.values(EventNames)) {
      this.events.set(eventName, eventNameToImplementation[eventName]);
    }
  }

  /**
   * This is internally called when an event is received from a peer Node.
   * Node consumers can separately setup their own callbacks for incoming events.
   * @param event
   * @param msg
   */
  public async callEvent(event: EventNames, msg: Message) {
    const start = Date.now();
    const controllerExecutionMethod = this.events.get(event);
    const controllerCount = this.router.eventListenerCount(event);

    if (!controllerExecutionMethod && controllerCount === 0) {
      if (event === EventNames.DEPOSIT_CONFIRMED_EVENT) {
        this.log.info(
          `No event handler for counter depositing into channel: ${JSON.stringify(
            msg,
            undefined,
            4,
          )}`,
        );
      } else {
        throw new Error(`Recent ${event} event which has no event handler`);
      }
    }

    if (controllerExecutionMethod) {
      await controllerExecutionMethod(this, msg);
    }

    logTime(
      this.log,
      start,
      `Event ${
        event !== EventNames.PROTOCOL_MESSAGE_EVENT
          ? event
          : `for ${(msg as ProtocolMessage).data.protocol} protocol`
      } was processed`,
    );
    this.router.emit(event, msg);
  }

  public async isLegacyEvent(event: EventNames) {
    return this.events.has(event);
  }

  public getSigner(): IChannelSigner {
    return this.signer;
  }

  public getSignerAddress(): Promise<string> {
    const signer = this.getSigner();
    return signer.getAddress();
  }
}
