import { MethodName, MethodParam, MethodResult, ProtocolNames, MethodNames } from "@connext/types";
import { capitalize, logTime, stringify } from "@connext/utils";

import { RequestHandler } from "../request-handler";
import { StateChannel } from "../models/state-channel";

export abstract class MethodController {
  public abstract methodName: MethodName;

  public async executeMethod(
    requestHandler: RequestHandler,
    params: MethodParam,
  ): Promise<MethodResult | undefined> {
    const log = requestHandler.log.newContext(
      `CF-${capitalize(this.methodName.replace(/^chan_/, ""))}`,
    );
    const start = Date.now();
    let substart = start;
    let lockValue: string = "";

    log.info(`Executing with params: ${stringify(params, true, 0)}`);

    const lockName = await this.getRequiredLockName(requestHandler, params);

    // Dont lock for static functions
    if (lockName !== "") {
      lockValue = await requestHandler.lockService.acquireLock(lockName);
      logTime(log, substart, `Acquired lock ${lockName}`);
      substart = Date.now();
    }

    // Helper function
    const fetchChannel = async (): Promise<StateChannel | undefined> => {
      if ((params as any).multisigAddress) {
        const json = await requestHandler.store.getStateChannel((params as any).multisigAddress);
        return json && StateChannel.fromJson(json);
      } else if ((params as any).responderIdentifier) {
        // TODO: should be able to to all of this with multisig address but its not showing up in some cases
        const json = await requestHandler.store.getStateChannelByOwners([
          (params as any).responderIdentifier,
          requestHandler.publicIdentifier,
        ]);
        return json && StateChannel.fromJson(json);
      }
      return undefined;
    };

    let result: MethodResult | undefined;
    let error: Error | undefined;
    let preProtocolStateChannel: StateChannel | undefined;
    try {
      // GET CHANNEL BEFORE EXECUTION
      preProtocolStateChannel = await fetchChannel();
      result = await this.beforeExecution(requestHandler, params, preProtocolStateChannel);
      logTime(log, substart, "Before execution complete");
      substart = Date.now();

      // GET UPDATED CHANNEL FROM EXECUTION
      result =
        (await this.executeMethodImplementation(requestHandler, params, preProtocolStateChannel)) ||
        result;
      logTime(log, substart, "Executed method implementation");
      substart = Date.now();

      // USE RETURNED VALUE IN AFTER EXECUTION
      await this.afterExecution(requestHandler, params, result as any);
      logTime(log, substart, "After execution complete");
      substart = Date.now();
    } catch (e) {
      error = e;
    }

    // retry if error
    const syncable =
      this.methodName !== MethodNames.chan_sync && this.methodName !== MethodNames.chan_create;
    if (preProtocolStateChannel && !!error && syncable) {
      // dispatch sync rpc call
      log.warn(
        `Caught error while running protocol, syncing channels and retrying ${
          this.methodName
        } with params ${stringify(params, true, 0)}. ${error.message}`,
      );

      // FETCH ONE MORE TIME, NEEDED IN CASE ERROR HAPPENED IN AFTER EXECUTION
      preProtocolStateChannel = (await fetchChannel())!;

      const { publicIdentifier, protocolRunner, router } = requestHandler;
      const responderIdentifier = [
        preProtocolStateChannel.initiatorIdentifier,
        preProtocolStateChannel.responderIdentifier,
      ].find((identifier) => identifier !== publicIdentifier)!;
      console.log(
        `[${preProtocolStateChannel.multisigAddress}:cf::${this.methodName}:::pre-sync] fb nonce:`,
        preProtocolStateChannel.freeBalance.latestVersionNumber,
        `, numApps: `,
        preProtocolStateChannel.numProposedApps,
      );
      try {
        const { channel } = await protocolRunner.initiateProtocol(
          router,
          ProtocolNames.sync,
          {
            multisigAddress: preProtocolStateChannel.multisigAddress,
            initiatorIdentifier: publicIdentifier,
            responderIdentifier,
          },
          preProtocolStateChannel,
        );
        log.debug(`Channel synced, retrying ${this.methodName} with ${channel.toJson()}`);
        console.log(
          `[${preProtocolStateChannel.multisigAddress}:cf::${this.methodName}:::post-sync] fb nonce:`,
          preProtocolStateChannel.freeBalance.latestVersionNumber,
          `, numApps: `,
          preProtocolStateChannel.numProposedApps,
        );
        result = await this.beforeExecution(requestHandler, params, channel);
        // if result exists, the operation is a no-op (i.e. already been done)
        result =
          result || (await this.executeMethodImplementation(requestHandler, params, channel));
        log.info(`Protocol ${this.methodName} successfully executed after sync`);

        await this.afterExecution(requestHandler, params, result!);
        logTime(log, substart, "After execution complete");

        error = undefined;
      } catch (e) {
        log.error(`Caught error in method controller while attempting retry + sync: ${e.stack}`);
        error = e;
      }
    }

    // don't do this in a finally to ensure any errors with releasing the
    // lock do not swallow any protocol or controller errors
    if (lockName !== "") {
      try {
        await requestHandler.lockService.releaseLock(lockName, lockValue);
      } catch (e) {
        log.error(`Caught error trying to release lock: ${e.message}`);
        error = error || e;
      }
      logTime(log, substart, `Released lock ${lockName}`);
      substart = Date.now();
    }

    if (error) {
      throw error;
    }

    log.debug(`Finished executing with result: ${stringify(result, true, 0)}`);

    return result;
  }

  protected async getRequiredLockName(
    requestHandler: RequestHandler,
    params: MethodParam,
  ): Promise<string> {
    return "";
  }

  // should return true IFF the channel is in the correct state before
  // method execution
  protected async beforeExecution(
    requestHandler: RequestHandler,
    params: MethodParam,
    preProtocolStateChannel: StateChannel | undefined,
  ): Promise<MethodResult | undefined> {
    return false;
  }

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
