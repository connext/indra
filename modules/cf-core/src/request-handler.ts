import {
  EventNames,
  IChannelSigner,
  ILoggerService,
  IMessagingService,
  IStoreService,
  MethodName,
  ProtocolMessage,
  PublicIdentifier,
  ILockService,
  EventName,
  ProtocolEventMessage,
  NetworkContexts,
  IOnchainTransactionService,
} from "@connext/types";
import { logTime } from "@connext/utils";
import EventEmitter from "eventemitter3";

import { eventImplementations } from "./message-handling";
import { methodImplementations } from "./methods";
import { ProtocolRunner } from "./machine";
import { RpcRouter } from "./rpc-router";
import { MethodRequest, MethodResponse } from "./types";
/**
 * This class registers handlers for requests to get or set some information
 * about app instances and channels for this Node and any relevant peer Nodes.
 */
export class RequestHandler {
  public router!: RpcRouter;

  constructor(
    readonly publicIdentifier: PublicIdentifier,
    readonly incoming: EventEmitter,
    readonly outgoing: EventEmitter,
    readonly store: IStoreService,
    readonly messagingService: IMessagingService,
    readonly protocolRunner: ProtocolRunner,
    readonly networkContexts: NetworkContexts,
    readonly signer: IChannelSigner,
    readonly blocksNeededForConfirmation: number,
    readonly lockService: ILockService,
    public readonly log: ILoggerService,
    readonly transactionService: IOnchainTransactionService | undefined,
  ) {
    this.log = this.log.newContext("CF-RequestHandler");
  }

  injectRouter(router: RpcRouter) {
    this.router = router;
    this.mapPublicApiMethods();
  }

  /**
   * In some use cases, waiting for the response of a method call is easier
   * and cleaner than wrangling through callback hell.
   * @param methodName
   * @param req
   */
  public async callMethod(methodName: MethodName, req: MethodRequest): Promise<MethodResponse> {
    if (!methodImplementations[methodName]) {
      throw new Error(`No implementation available for method ${methodName}`);
    }
    const start = Date.now();
    const result: MethodResponse = {
      type: req.type,
      requestId: req.requestId,
      result: await methodImplementations[methodName](this, req.params),
    };
    logTime(this.log, start, `Method ${methodName} was executed`);
    return result;
  }

  /**
   * This registers all of the methods the Node is expected to have
   */
  private mapPublicApiMethods() {
    for (const methodName of Object.keys(methodImplementations)) {
      this.incoming.on(methodName, async (req: MethodRequest) => {
        const res: MethodResponse = {
          type: req.type,
          requestId: req.requestId,
          result: await methodImplementations[methodName](this, req.params),
        };
        this.router.emit((req as any).methodName, res, "outgoing");
      });
    }
  }

  /**
   * This is internally called when an event is received from a peer Node.
   * Node consumers can separately setup their own callbacks for incoming events.
   * @param event
   * @param msg
   */
  public async callEvent<T extends EventName>(event: T, msg: ProtocolEventMessage<T>) {
    const start = Date.now();
    const controllerExecutionMethod = eventImplementations[event as string];
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

  public async isLegacyEvent(event: EventName) {
    return Object.keys(eventImplementations).includes(event);
  }

  public getSigner(): IChannelSigner {
    return this.signer;
  }

  public getSignerAddress(): Promise<string> {
    const signer = this.getSigner();
    return signer.getAddress();
  }
}
