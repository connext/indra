import {
  bigNumberifyJson,
  EventNames,
  ILoggerService,
  IMessagingService,
  IStoreService,
  MethodName,
  NetworkContext,
  NodeMessage,
  NodeMessageWrappedProtocolMessage,
} from "@connext/types";
import { Signer } from "ethers";
import { JsonRpcProvider } from "ethers/providers";
import EventEmitter from "eventemitter3";

import { eventNameToImplementation, methodNameToImplementation } from "./methods";
import { ProtocolRunner } from "./machine";
import ProcessQueue from "./process-queue";
import RpcRouter from "./rpc-router";
import { MethodRequest, MethodResponse } from "./types"; 
import { logTime } from "./utils";
/**
 * This class registers handlers for requests to get or set some information
 * about app instances and channels for this Node and any relevant peer Nodes.
 */
export class RequestHandler {
  private readonly methods = new Map();
  private readonly events = new Map();

  router!: RpcRouter;

  constructor(
    readonly publicIdentifier: string,
    readonly incoming: EventEmitter,
    readonly outgoing: EventEmitter,
    readonly store: IStoreService,
    readonly messagingService: IMessagingService,
    readonly protocolRunner: ProtocolRunner,
    readonly networkContext: NetworkContext,
    readonly provider: JsonRpcProvider,
    readonly wallet: Signer,
    readonly blocksNeededForConfirmation: number,
    public readonly processQueue: ProcessQueue,
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
  public async callMethod(
    method: MethodName,
    req: MethodRequest,
  ): Promise<MethodResponse> {
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
  public async callEvent(event: EventNames, msg: NodeMessage) {
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
          : `for ${(msg as NodeMessageWrappedProtocolMessage).data.protocol} protocol`
      } was processed`,
    );
    this.router.emit(event, msg);
  }

  public async isLegacyEvent(event: EventNames) {
    return this.events.has(event);
  }

  public async getSigner(): Promise<Signer> {
    return this.wallet;
  }

  public async getSignerAddress(): Promise<string> {
    const signer = await this.getSigner();
    return await signer.getAddress();
  }
}
