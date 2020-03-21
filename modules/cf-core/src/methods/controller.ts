import { MethodName, MethodParam, MethodResult } from "@connext/types";
import { Controller } from "rpc-server";

import { RequestHandler } from "../request-handler";

export abstract class NodeController extends Controller {
  public static readonly methodName: MethodName;

  public async executeMethod(
    requestHandler: RequestHandler,
    params: MethodParam,
  ): Promise<MethodResult> {
    await this.beforeExecution(requestHandler, params);

    const lockNames = await this.getRequiredLockNames(requestHandler, params);

    const lockValues: string[] = await Promise.all(lockNames.map((name)=> {
      return requestHandler.lockService.acquireLock(name);
    }));

    const ret = await this.executeMethodImplementation(requestHandler, params);

    await Promise.all(lockNames.map((name, index)=> {
      return requestHandler.lockService.releaseLock(name, lockValues[index]);
    }));

    await this.afterExecution(requestHandler, params);

    return ret;
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
  ): Promise<void> {}

  protected async getRequiredLockNames(
    requestHandler: RequestHandler,
    params: MethodParam,
  ): Promise<string[]> {
    return [];
  }
}
