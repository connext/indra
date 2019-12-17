import { Controller } from "rpc-server";

import { RequestHandler } from "../request-handler";
import { CFCoreTypes } from "../types";

export abstract class NodeController extends Controller {
  public static readonly methodName: CFCoreTypes.MethodName;

  public async executeMethod(
    requestHandler: RequestHandler,
    params: CFCoreTypes.MethodParams,
  ): Promise<CFCoreTypes.MethodResult> {
    await this.beforeExecution(requestHandler, params);

    const lockNames = await this.getRequiredLockNames(requestHandler, params);

    const createExecutionPromise = () =>
      this.executeMethodImplementation(requestHandler, params);

    const ret = await requestHandler.processQueue.addTask(
      lockNames,
      createExecutionPromise
    );

    await this.afterExecution(requestHandler, params);

    return ret;
  }

  protected abstract executeMethodImplementation(
    requestHandler: RequestHandler,
    params: CFCoreTypes.MethodParams
  ): Promise<CFCoreTypes.MethodResult>;

  protected async beforeExecution(
    // @ts-ignore
    requestHandler: RequestHandler,
    // @ts-ignore
    params: CFCoreTypes.MethodParams
  ): Promise<void> {}

  protected async afterExecution(
    // @ts-ignore
    requestHandler: RequestHandler,
    // @ts-ignore
    params: CFCoreTypes.MethodParams
  ): Promise<void> {}

  protected async getRequiredLockNames(
    // @ts-ignore
    requestHandler: RequestHandler,
    // @ts-ignore
    params: CFCoreTypes.MethodParams
  ): Promise<string[]> {
    return [];
  }
}
