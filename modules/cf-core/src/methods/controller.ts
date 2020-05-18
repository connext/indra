import { MethodName, MethodParam, MethodResult } from "@connext/types";
import { Controller } from "rpc-server";

import { RequestHandler } from "../request-handler";
import { ColorfulLogger, logTime } from "@connext/utils";

export abstract class NodeController extends Controller {
  public static readonly methodName: MethodName;

  public async executeMethod(
    requestHandler: RequestHandler,
    params: MethodParam,
  ): Promise<MethodResult> {
    const log = new ColorfulLogger(`MethodController`, 1, true);
    const start = Date.now();
    let substart = start;
    await this.beforeExecution(requestHandler, params);
    logTime(log, substart, "Before execution complete");
    substart = Date.now();

    const lockName = await this.getRequiredLockName(requestHandler, params);
    logTime(log, substart, "Got lockname");
    substart = Date.now();

    const lockValue = await requestHandler.lockService.acquireLock(lockName);
    logTime(log, substart, "Got lock");
    substart = Date.now();

    const ret = await this.executeMethodImplementation(requestHandler, params);
    logTime(log, substart, "Executed method implementation");
    substart = Date.now();

    await requestHandler.lockService.releaseLock(lockName, lockValue);
    logTime(log, substart, "Released lock");
    substart = Date.now();

    await this.afterExecution(requestHandler, params, ret);
    logTime(log, substart, "After execution complete");
    substart = Date.now();

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
    returnValue: MethodResult,
  ): Promise<void> {}

  protected async getRequiredLockName(
    requestHandler: RequestHandler,
    params: MethodParam,
  ): Promise<string> {
    return "";
  }
}
