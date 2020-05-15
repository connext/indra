import { ILoggerService, MethodName, MethodParam, MethodResult } from "@connext/types";
import { Controller } from "rpc-server";

import { RequestHandler } from "../request-handler";

export abstract class NodeController extends Controller {
  public static readonly methodName: MethodName;
  public log?: ILoggerService;

  public async executeMethod(
    requestHandler: RequestHandler,
    params: MethodParam,
  ): Promise<MethodResult> {
    await this.beforeExecution(requestHandler, params);

    const result = await requestHandler.processQueue.addTask(
      await this.getRequiredLockNames(requestHandler, params),
      () => this.executeMethodImplementation(requestHandler, params),
    );

    await this.afterExecution(requestHandler, params, result);
    return result;
  }

  protected abstract executeMethodImplementation(
    requestHandler: RequestHandler,
    params: MethodParam,
  ): Promise<MethodResult>;

  protected async beforeExecution(
    requestHandler: RequestHandler,
    params: MethodParam,
  ): Promise<void> {}

  protected async afterExecution(
    requestHandler: RequestHandler,
    params: MethodParam,
    returnValue: MethodResult,
  ): Promise<void> {}

  protected async getRequiredLockNames(
    requestHandler: RequestHandler,
    params: MethodParam,
  ): Promise<string[]> {
    return [];
  }
}
