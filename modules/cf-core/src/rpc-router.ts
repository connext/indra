import { ILoggerService, JsonRpcResponse, Rpc } from "@connext/types";
import { bigNumberifyJson, logTime } from "@connext/utils";

import { RequestHandler } from "./request-handler";

type AsyncCallback = (...args: any) => Promise<any>;

const jsonRpcSerializeAsResponse = (result: any, id: number): JsonRpcResponse => {
  return { jsonrpc: "2.0", result, id };
};

export class Controller {
  static jsonapiType: string;
  static rpcMethods: {
    [key: string]: { method: string; callback: string; type: typeof Controller };
  } = {};
}

export const jsonRpcMethod = (name: string) => {
  return (target: Controller, propertyKey: string) => {
    const constructor = target.constructor as typeof Controller;
    constructor.rpcMethods[`${constructor.name}:${name}`] = {
      method: name,
      callback: propertyKey,
      type: constructor,
    };
  };
};

export class RpcRouter {
  private readonly requestHandler: RequestHandler;
  private readonly log: ILoggerService;
  private controllers: Array<typeof Controller>;

  constructor({
    controllers,
    requestHandler,
  }: {
    controllers: typeof Controller[];
    requestHandler: RequestHandler;
  }) {
    this.controllers = controllers;
    this.requestHandler = requestHandler;
    this.log = requestHandler.log.newContext("CF-RpcRouter");
  }

  async dispatch(rpc: Rpc): Promise<JsonRpcResponse> {
    const start = Date.now();
    const controller = Object.values(Controller.rpcMethods).find(
      (mapping) => mapping.method === rpc.methodName,
    );

    if (!controller) {
      throw new Error(`Cannot execute ${rpc.methodName}: no controller`);
    }

    const result = jsonRpcSerializeAsResponse(
      {
        result: await new controller.type()[controller.callback](
          this.requestHandler,
          bigNumberifyJson(rpc.parameters),
        ),
        type: rpc.methodName,
      },
      rpc.id as number,
    );

    this.requestHandler.outgoing.emit(rpc.methodName, result);

    logTime(this.log, start, `Processed ${rpc.methodName} method`);
    return result;
  }

  async subscribe(event: string, callback: AsyncCallback) {
    this.requestHandler.outgoing.on(event, callback);
  }

  async subscribeOnce(event: string, callback: AsyncCallback) {
    this.requestHandler.outgoing.once(event, callback);
  }

  async unsubscribe(event: string, callback?: AsyncCallback) {
    this.requestHandler.outgoing.off(event, callback);
  }

  async emit(event: string, data: any, emitter = "incoming") {
    let eventData = data;

    if (!eventData["jsonrpc"]) {
      // It's a legacy message. Reformat it to JSONRPC.
      eventData = jsonRpcSerializeAsResponse(eventData, Date.now());
    }

    this.requestHandler[emitter].emit(event, eventData.result);
  }

  eventListenerCount(event: string): number {
    return typeof this.requestHandler.outgoing.listenerCount === "function"
      ? this.requestHandler.outgoing.listenerCount(event)
      : 0;
  }
}

export default RpcRouter;
