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
    const lockValues: Map<string, string> = new Map();

    log.info(`Executing with params: ${stringify(params, true, 0)}`);

    const lockNames = await this.getRequiredLockNames(requestHandler, params);

    // Dont lock for static functions
    if (lockNames.length > 0) {
      await Promise.all(
        lockNames.map(async (lockName) => {
          const lockValue = await requestHandler.lockService.acquireLock(lockName);
          lockValues.set(lockName, lockValue);
        }),
      );
      logTime(log, substart, `Acquired locks ${lockNames}`);
      substart = Date.now();
    }

    // Helper function
    const fetchChannel = async (): Promise<StateChannel | undefined> => {
      if ((params as any).multisigAddress) {
        const json = await requestHandler.store.getStateChannel((params as any).multisigAddress);
        return json && StateChannel.fromJson(json);
      } else if ((params as any).responderIdentifier) {
        // TODO: should be able to to all of this with multisig address but its not showing up in some cases
        const json = await requestHandler.store.getStateChannelByOwnersAndChainId(
          [(params as any).responderIdentifier, requestHandler.publicIdentifier],
          (params as any).chainId,
        );
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
      this.methodName !== MethodNames.chan_sync &&
      this.methodName !== MethodNames.chan_create &&
      this.methodName !== MethodNames.chan_deployStateDepositHolder;
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
      try {
        // NOTE: sync always requires the multisig lock since the free balance
        // or channel nonce could be out of sync even in takeAction failures
        if (!lockNames.includes(preProtocolStateChannel.multisigAddress)) {
          // acquire the multisig lock
          log.info("Acquiring multisig lock before syncing");
          const lockValue = await requestHandler.lockService.acquireLock(
            preProtocolStateChannel.multisigAddress,
          );
          lockValues.set(preProtocolStateChannel.multisigAddress, lockValue);
          // add to the lockNames variable so it can be properly released
          lockNames.push(preProtocolStateChannel.multisigAddress);
        }
        log.info("All locks acquired, syncing");
        // only sync apps in cases for uninstall and take action protocols,
        // otherwise sync channel only
        const shouldProvideAppId =
          this.methodName === MethodNames.chan_uninstall ||
          this.methodName === MethodNames.chan_takeAction;
        const appIdentityHash =
          shouldProvideAppId &&
          !!(params as any).appIdentityHash &&
          (params as any).appIdentityHash !== preProtocolStateChannel.freeBalance.identityHash
            ? (params as any).appIdentityHash
            : undefined;
        const { channel } = await protocolRunner.initiateProtocol(
          router,
          ProtocolNames.sync,
          {
            multisigAddress: preProtocolStateChannel.multisigAddress,
            initiatorIdentifier: publicIdentifier,
            responderIdentifier,
            appIdentityHash,
            chainId: preProtocolStateChannel.chainId,
          },
          preProtocolStateChannel,
        );
        log.debug(
          `Channel synced, retrying ${this.methodName} with ${stringify(
            channel.toJson(),
            true,
            0,
          )}`,
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
    if (lockNames.length > 0) {
      await Promise.all(
        lockNames.map(async (lockName) => {
          try {
            await requestHandler.lockService.releaseLock(lockName, lockValues.get(lockName)!);
            lockValues.delete(lockName);
          } catch (e) {
            log.error(`Caught error trying to release lock ${lockName}: ${e.message}`);
            error = error || e;
          }
        }),
      );
      logTime(log, substart, `Acquired locks ${lockNames}`);
      substart = Date.now();
    }

    if (error) {
      throw error;
    }

    log.debug(`Finished executing with result: ${stringify(result, true, 0)}`);

    return result;
  }

  protected async getRequiredLockNames(
    requestHandler: RequestHandler,
    params: MethodParam,
  ): Promise<string[]> {
    return [];
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
