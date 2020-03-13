import { Controller } from "rpc-server";

import { RequestHandler } from "../request-handler";
import {
  MethodName,
  MethodParams,
  MethodResult,
} from "../types";

export abstract class NodeController extends Controller {
  public static readonly methodName: MethodName;

  public async executeMethod(
    requestHandler: RequestHandler,
    params: MethodParams,
  ): Promise<MethodResult> {
    await this.beforeExecution(requestHandler, params);

    const lockNames = await this.getRequiredLockNames(requestHandler, params);

    const createExecutionPromise = () => this.executeMethodImplementation(requestHandler, params);

    const ret = await requestHandler.processQueue.addTask(lockNames, createExecutionPromise);

    await this.afterExecution(requestHandler, params);

    return ret;
  }

  protected abstract executeMethodImplementation(
    requestHandler: RequestHandler,
    params: MethodParams,
  ): Promise<MethodResult>;

  protected async beforeExecution(
    requestHandler: RequestHandler,
    params: MethodParams,
  ): Promise<void> {}

  protected async afterExecution(
    requestHandler: RequestHandler,
    params: MethodParams,
  ): Promise<void> {}

  protected async getRequiredLockNames(
    requestHandler: RequestHandler,
    params: MethodParams,
  ): Promise<string[]> {
    return [];
  }
}
