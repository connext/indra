import { JsonRpcResponse, Rpc } from "@connext/types";

export class Controller {
  static jsonapiType: string;
  static rpcMethods: {
    [key: string]: { method: string; callback: string; type: typeof Controller };
  } = {};
}

export class Router {
  protected controllers: Array<typeof Controller>;
  constructor({ controllers }: { controllers: Array<typeof Controller> }) {
    this.controllers = controllers;
  }
  async dispatch(rpc: Rpc) {
    const controller = Object.values(Controller.rpcMethods)
      .find(mapping => mapping.method === rpc.methodName);
    if (!controller) {
      console.warn(`Cannot execute ${rpc.methodName}: no controller`);
      return;
    }
    return new controller.type()[controller.callback](rpc.parameters);
  }
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

export const jsonRpcSerializeAsResponse = (result: any, id: number): JsonRpcResponse => {
  return {
    jsonrpc: "2.0",
    result,
    id,
  };
};
