import { MethodName, MethodParam, MethodResult } from "@connext/types";
import { Controller } from "rpc-server";
import { ColorfulLogger, logTime } from "@connext/utils";

import { RequestHandler } from "../request-handler";
import { StateChannel } from "../models/state-channel";

export abstract class NodeController extends Controller {
  public static readonly methodName: MethodName;

  public async executeMethod(
    requestHandler: RequestHandler,
    params: MethodParam,
  ): Promise<MethodResult | undefined> {
    const log = new ColorfulLogger(`MethodController`, 1, true);
    const start = Date.now();
    let substart = start;
    let lockValue: string = "";

    const lockName = await this.getRequiredLockName(requestHandler, params);
    logTime(log, substart, "Got lockname");
    substart = Date.now();

    // Dont lock for static functions
    if (lockName !== "") {
      lockValue = await requestHandler.lockService.acquireLock(lockName);
      logTime(log, substart, "Got lock");
      substart = Date.now();
    }

    let ret: MethodResult | undefined;
    try {
      // GET CHANNEL BEFORE EXECUTION
      let preProtocolStateChannel: StateChannel | undefined;
      if ((params as any).multisigAddress) {
        const json = await requestHandler.store.getStateChannel((params as any).multisigAddress);
        preProtocolStateChannel = json && StateChannel.fromJson(json);
      } else if ((params as any).responderIdentifier) {
        // TODO: should be able to to all of this with multisig address but its not showing up in some cases
        const json = await requestHandler.store.getStateChannelByOwners([
          (params as any).responderIdentifier,
          requestHandler.publicIdentifier,
        ]);
        preProtocolStateChannel = json && StateChannel.fromJson(json);
      }
      await this.beforeExecution(requestHandler, params, preProtocolStateChannel);
      logTime(log, substart, "Before execution complete");
      substart = Date.now();

      // GET UPDATED CHANNEL FROM EXECUTION
      ret = await this.executeMethodImplementation(requestHandler, params, preProtocolStateChannel);
      logTime(log, substart, "Executed method implementation");
      substart = Date.now();

      // USE UPDATED CHANNEL IN AFETR EXECUTION
      await this.afterExecution(requestHandler, params, ret);
      logTime(log, substart, "After execution complete");
      substart = Date.now();
    } catch (e) {
      throw e;
    } finally {
      if (lockName !== "") {
        await requestHandler.lockService.releaseLock(lockName, lockValue);
        logTime(log, substart, "Released lock");
        substart = Date.now();
      }
    }

    return ret;
  }

  protected async getRequiredLockName(
    requestHandler: RequestHandler,
    params: MethodParam,
  ): Promise<string> {
    return "";
  }

  protected async beforeExecution(
    requestHandler: RequestHandler,
    params: MethodParam,
    preProtocolStateChannel: StateChannel | undefined,
  ): Promise<void> {}

  protected abstract executeMethodImplementation(
    requestHandler: RequestHandler,
    params: MethodParam,
    preProtocolStateChannel: StateChannel | undefined,
  ): Promise<MethodResult>;

  protected async afterExecution(
    requestHandler: RequestHandler,
    params: MethodParam,
    returnValue: MethodResult,
  ): Promise<void> {}
}
